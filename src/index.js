// Express adapter for dynamodb-toolkit v3.
//
// Translates Express `(req, res, next)` into the toolkit's framework-agnostic pieces:
//   - matchRoute (dynamodb-toolkit/handler) for route-shape recognition
//   - parsers / builders / policy (dynamodb-toolkit/rest-core) for wire format
//   - a consumer-supplied Adapter for the DynamoDB layer
//
// Wire contract matches the bundled node:http handler (dynamodb-toolkit/handler):
// same routes, same envelope, same status codes, same option shape — just
// translated for `req`/`res` I/O so downstream Express middleware sees a
// well-formed response it can transform (compression, conditional-get,
// loggers, etc).

import {
  parseFields,
  parseSort,
  parseFilter,
  parsePatch,
  parseNames,
  parsePaging,
  parseFlag,
  buildEnvelope,
  paginationLinks,
  mergePolicy,
  mapErrorStatus
} from 'dynamodb-toolkit/rest-core';
import {matchRoute} from 'dynamodb-toolkit/handler';

import {readJsonBody} from './read-body.js';

// Express's default `qs` parser can produce nested objects and arrays of
// objects in `req.query`. rest-core parsers expect plain strings. Keep string
// values as-is, collapse string[] to its first element (matches
// URLSearchParams.get), and drop anything else — nested shapes aren't
// expressible in the documented route contract.
const coerceStringQuery = query => {
  const out = {};
  for (const k of Object.keys(query)) {
    const v = query[k];
    if (typeof v === 'string') {
      out[k] = v;
    } else if (Array.isArray(v) && typeof v[0] === 'string') {
      out[k] = v[0];
    }
  }
  return out;
};

// Prefer a pre-parsed body (`express.json()` or equivalent populates
// `req.body`). Fall back to streaming the raw Node request with our own cap.
// Pre-parsed bodies bypass maxBodyBytes — the body parser is expected to
// enforce its own cap.
const getBody = async (req, maxBodyBytes) => {
  if (req.body !== undefined) return req.body;
  return readJsonBody(req, maxBodyBytes);
};

export const createExpressAdapter = (adapter, options = {}) => {
  const policy = mergePolicy(options.policy);
  const sortableIndices = options.sortableIndices || {};
  const keyFromPath = options.keyFromPath || ((rawKey, adp) => ({[adp.keyFields[0]]: rawKey}));
  const exampleFromContext = options.exampleFromContext || (() => ({}));
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;

  const buildListOptions = query => {
    const fields = parseFields(query.fields);
    const filter = parseFilter(query.filter);
    const paging = parsePaging(query, {defaultLimit: policy.defaultLimit, maxLimit: policy.maxLimit, maxOffset: policy.maxOffset});
    const consistent = parseFlag(query.consistent);
    /** @type {import('dynamodb-toolkit').ListOptions} */
    const out = {...paging, consistent, needTotal: policy.needTotal};
    if (fields) out.fields = fields;
    if (filter) out.filter = filter.query;
    return out;
  };

  const resolveSort = query => {
    const sort = parseSort(query.sort);
    if (!sort) return {index: undefined, descending: false};
    return {index: sortableIndices[sort.field], descending: sort.direction === 'desc'};
  };

  const sendError = (res, err) => {
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : mapErrorStatus(err, policy.statusCodes);
    res.status(status).json(policy.errorBody(err));
  };

  const sendJson = (res, status, body) => {
    res.status(status).json(body);
  };

  // Use `res.end()` (not `res.json()`) so the configured status is preserved
  // with an empty body. Express doesn't have Koa's null-body → 204 coercion,
  // but we still want empty for 204/404/410/etc to avoid shipping "null".
  const sendNoContent = (res, status = 204) => {
    res.status(status).end();
  };

  const urlBuilderFor = req => {
    // req.originalUrl is the full path+query as received (before any upstream
    // middleware or `app.use(prefix, adapter)` rewrote req.url). Building
    // pagination links off it means the next/prev URLs point back at the
    // same endpoint the client hit.
    const base = new URL(req.originalUrl || req.url || '/', 'http://local');
    return ({offset, limit}) => {
      const u = new URL(base);
      u.searchParams.set('offset', String(offset));
      u.searchParams.set('limit', String(limit));
      return u.pathname + u.search;
    };
  };

  // --- collection-level handlers ---

  const handleGetAll = async (req, res, query) => {
    const opts = buildListOptions(query);
    const {index, descending} = resolveSort(query);
    if (descending) opts.descending = true;
    const example = exampleFromContext(query, null, req);
    const result = await adapter.getAll(opts, example, index);

    const links = paginationLinks(result.offset, result.limit, result.total, urlBuilderFor(req));
    const envelopeOpts = {keys: policy.envelope};
    if (links.prev || links.next) envelopeOpts.links = links;
    sendJson(res, 200, buildEnvelope(result, envelopeOpts));
  };

  const handlePost = async (req, res) => {
    const body = await getBody(req, maxBodyBytes);
    await adapter.post(body);
    sendNoContent(res);
  };

  const handleDeleteAll = async (req, res, query) => {
    const opts = buildListOptions(query);
    const {index} = resolveSort(query);
    const example = exampleFromContext(query, null, req);
    const params = await adapter._buildListParams(opts, false, example, index);
    const r = await adapter.deleteAllByParams(params);
    sendJson(res, 200, {processed: r.processed});
  };

  // --- /-by-names handlers ---

  const handleGetByNames = async (_req, res, query) => {
    const names = parseNames(query.names);
    const fields = parseFields(query.fields);
    const consistent = parseFlag(query.consistent);
    const keys = names.map(name => keyFromPath(name, adapter));
    const items = await adapter.getByKeys(keys, fields, {consistent});
    sendJson(res, 200, items);
  };

  const handleDeleteByNames = async (req, res, query) => {
    const namesQ = parseNames(query.names);
    let names = namesQ;
    if (!names.length) {
      const body = await getBody(req, maxBodyBytes);
      if (Array.isArray(body)) names = body.map(s => String(s));
    }
    const keys = names.map(name => keyFromPath(name, adapter));
    const r = await adapter.deleteByKeys(keys);
    sendJson(res, 200, {processed: r.processed});
  };

  const handleCloneByNames = async (req, res, query) => {
    const namesQ = parseNames(query.names);
    const body = await getBody(req, maxBodyBytes);
    let names = namesQ;
    if (!names.length && Array.isArray(body)) names = body.map(s => String(s));
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const keys = names.map(name => keyFromPath(name, adapter));
    const r = await adapter.cloneByKeys(keys, item => ({...item, ...overlay}));
    sendJson(res, 200, {processed: r.processed});
  };

  const handleMoveByNames = async (req, res, query) => {
    const namesQ = parseNames(query.names);
    const body = await getBody(req, maxBodyBytes);
    let names = namesQ;
    if (!names.length && Array.isArray(body)) names = body.map(s => String(s));
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const keys = names.map(name => keyFromPath(name, adapter));
    const r = await adapter.moveByKeys(keys, item => ({...item, ...overlay}));
    sendJson(res, 200, {processed: r.processed});
  };

  const handleLoad = async (req, res) => {
    const body = await getBody(req, maxBodyBytes);
    if (!Array.isArray(body)) {
      return sendError(res, Object.assign(new Error('Body must be an array of items'), {status: 400, code: 'BadLoadBody'}));
    }
    const r = await adapter.putAll(body);
    sendJson(res, 200, {processed: r.processed});
  };

  const handleCloneAll = async (req, res, query) => {
    const body = await getBody(req, maxBodyBytes);
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const opts = buildListOptions(query);
    const {index} = resolveSort(query);
    const example = exampleFromContext(query, body, req);
    const params = await adapter._buildListParams(opts, false, example, index);
    const r = await adapter.cloneAllByParams(params, item => ({...item, ...overlay}));
    sendJson(res, 200, {processed: r.processed});
  };

  const handleMoveAll = async (req, res, query) => {
    const body = await getBody(req, maxBodyBytes);
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const opts = buildListOptions(query);
    const {index} = resolveSort(query);
    const example = exampleFromContext(query, body, req);
    const params = await adapter._buildListParams(opts, false, example, index);
    const r = await adapter.moveAllByParams(params, item => ({...item, ...overlay}));
    sendJson(res, 200, {processed: r.processed});
  };

  // --- item-level handlers ---

  const handleItemGet = async (_req, res, key, query) => {
    const fields = parseFields(query.fields);
    const consistent = parseFlag(query.consistent);
    const item = await adapter.getByKey(key, fields, {consistent});
    if (item === undefined) return sendNoContent(res, policy.statusCodes.miss);
    sendJson(res, 200, item);
  };

  const handleItemPut = async (req, res, key, query) => {
    const body = await getBody(req, maxBodyBytes);
    const force = parseFlag(query.force);
    const merged = {...body, ...key};
    await adapter.put(merged, {force});
    sendNoContent(res);
  };

  const handleItemPatch = async (req, res, key) => {
    const body = await getBody(req, maxBodyBytes);
    const {patch, options: patchOptions} = parsePatch(body, {metaPrefix: policy.metaPrefix});
    await adapter.patch(key, patch, patchOptions);
    sendNoContent(res);
  };

  const handleItemDelete = async (_req, res, key) => {
    await adapter.delete(key);
    sendNoContent(res);
  };

  const handleItemClone = async (req, res, key, query) => {
    const body = await getBody(req, maxBodyBytes);
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const force = parseFlag(query.force);
    const result = await adapter.clone(key, item => ({...item, ...overlay}), {force});
    if (result === undefined) return sendNoContent(res, policy.statusCodes.miss);
    sendNoContent(res);
  };

  const handleItemMove = async (req, res, key, query) => {
    const body = await getBody(req, maxBodyBytes);
    const overlay = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const force = parseFlag(query.force);
    const result = await adapter.move(key, item => ({...item, ...overlay}), {force});
    if (result === undefined) return sendNoContent(res, policy.statusCodes.miss);
    sendNoContent(res);
  };

  return (req, res, next) => {
    const query = coerceStringQuery(req.query);
    const route = matchRoute(req.method, req.path, policy.methodPrefix);

    // Unknown route shape — hand back to the Express middleware chain so
    // other handlers (or Express's default 404) can respond.
    if (route.kind === 'unknown') return next();

    // Wrap the async dispatch so Express 4 (no async-handler auto-await)
    // still surfaces unexpected errors through `next(err)`. Handled errors
    // flow through `sendError` directly; only truly unhandleable failures
    // reach `next`.
    const dispatch = async () => {
      try {
        switch (route.kind) {
          case 'root':
            if (route.method === 'GET') return await handleGetAll(req, res, query);
            if (route.method === 'POST') return await handlePost(req, res);
            if (route.method === 'DELETE') return await handleDeleteAll(req, res, query);
            break;
          case 'collectionMethod':
            if (route.method === 'GET' && route.name === 'by-names') return await handleGetByNames(req, res, query);
            if (route.method === 'DELETE' && route.name === 'by-names') return await handleDeleteByNames(req, res, query);
            if (route.method === 'PUT' && route.name === 'load') return await handleLoad(req, res);
            if (route.method === 'PUT' && route.name === 'clone') return await handleCloneAll(req, res, query);
            if (route.method === 'PUT' && route.name === 'move') return await handleMoveAll(req, res, query);
            if (route.method === 'PUT' && route.name === 'clone-by-names') return await handleCloneByNames(req, res, query);
            if (route.method === 'PUT' && route.name === 'move-by-names') return await handleMoveByNames(req, res, query);
            break;
          case 'item': {
            const key = keyFromPath(route.key, adapter);
            if (route.method === 'GET') return await handleItemGet(req, res, key, query);
            if (route.method === 'PUT') return await handleItemPut(req, res, key, query);
            if (route.method === 'PATCH') return await handleItemPatch(req, res, key);
            if (route.method === 'DELETE') return await handleItemDelete(req, res, key);
            break;
          }
          case 'itemMethod': {
            const key = keyFromPath(route.key, adapter);
            if (route.method === 'PUT' && route.name === 'clone') return await handleItemClone(req, res, key, query);
            if (route.method === 'PUT' && route.name === 'move') return await handleItemMove(req, res, key, query);
            break;
          }
        }
        // Route shape matched, but no handler for this method — explicit 405.
        return sendError(res, Object.assign(new Error('Method not allowed for this route'), {status: 405, code: 'MethodNotAllowed'}));
      } catch (err) {
        sendError(res, err);
      }
    };

    dispatch().catch(next);
  };
};
