# Architecture — dynamodb-toolkit-express

Internal layout and design notes for maintainers. Consumer-facing docs live in the [wiki](https://github.com/uhop/dynamodb-toolkit-express/wiki); the machine-readable API reference is in `llms.txt` / `llms-full.txt`.

## Shape

ESM-only JavaScript with a hand-written `.d.ts` sidecar next to every `.js` — no build step, no transpiler. Zero runtime dependencies; `dynamodb-toolkit` and `express` are peer dependencies (`express` ranges over `^4.21.0 || ^5.0.0`). Each `.js` opens with a `// @ts-self-types="./<file>.d.ts"` directive so its sibling `.d.ts` is the sole source of types and docs; `.js` files hold no JSDoc beyond the load-bearing inline `/** @type */` annotations the implementation needs to type-check (the `ListOptions` and write-body casts in `index.js`).

A framework adapter, not a framework. All parsing, envelope building, policy merging, and route-shape matching are delegated to the parent toolkit; this package owns only the Express `(req, res, next)` translation and error mapping.

## Composition

`createExpressAdapter(adapter, options)` is the single public entry. It closes over the merged `policy`, `sortableIndices`, `keyFromPath` / `exampleFromContext` extractors, and `maxBodyBytes`, then returns one Express `RequestHandler`. The returned middleware is the whole runtime surface — there is no per-request object construction beyond the closures.

Delegation targets in the parent:

| Import                                                                                                                                                         | Responsibility                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dynamodb-toolkit/rest-core` (`parse*`, `build*`, `mergePolicy`, `mapErrorStatus`, `resolveSort`, `coerceStringQuery`, `validateWriteBody`, `paginationLinks`) | Framework-agnostic REST primitives — parsers, builders, policy, DoS gates.      |
| `dynamodb-toolkit/handler` (`matchRoute`, `readJsonBody`)                                                                                                      | Route-shape matching (`HEAD → GET` auto-promote) and the streaming body reader. |
| consumer-supplied `Adapter`                                                                                                                                    | The DynamoDB layer — `getList` / `getByKey` / `put` / `patch` / mass ops.       |

## Dispatch

The returned middleware coerces `req.query` (`coerceStringQuery`), then `matchRoute(req.method, req.path, policy.methodPrefix)` classifies the request into one of four `route.kind` buckets, dispatched by an async `dispatch()`:

- `root` — `GET` / `POST` / `DELETE /` → list / post / `deleteListByParams`.
- `collectionMethod` — the `-by-names`, `-load`, `-clone` / `-move`, `-clone-by-names` / `-move-by-names` endpoints.
- `item` — `GET` / `PUT` / `PATCH` / `DELETE /:key` (the `:key` segment runs through `keyFromPath`).
- `itemMethod` — single-item `PUT /:key/-clone`, `PUT /:key/-move`.

Two non-handler outcomes:

- **Unknown route shape** → `next()` — the request falls through to the rest of the Express chain (other handlers, or Express's default 404).
- **Known shape, unsupported method** → explicit `405 Method Not Allowed`.

`dispatch()` is wrapped so that Express 4 — which does not auto-await async handlers — still surfaces unhandled rejections through `next(err)`. Handled errors flow through `sendError` directly; only truly unhandleable failures reach `next`. This keeps a single code path correct across the `^4.21.0 || ^5.0.0` peer range.

## Request handling

- **Body** — `getBody` prefers a pre-parsed `req.body` (when `express.json()` or equivalent is mounted upstream, the parser's own cap applies). Absent that, it streams the raw request through `readJsonBody` with the byte-accurate `maxBodyBytes` cap (1 MiB default), passing `destroy: false` so the socket stays alive for the `413` response to flush. A pre-consumed stream (`readableEnded` / `complete`) resolves to `null` instead of hanging.
- **Responses** — `sendJson` for bodies, `sendNoContent` using `res.end()` (not `res.json()`) to preserve a configured status with a genuinely empty body (Express lacks Koa's null-body → 204 coercion). `sendError` maps through `policy.errorBody` + `mapErrorStatus`; once headers are flushed it forwards to `next(err)` rather than throwing `ERR_HTTP_HEADERS_SENT`.
- **Pagination** — `urlBuilderFor` builds next/prev links off `req.originalUrl` (the path+query as received, before any `app.use(prefix, ...)` rewrote `req.url`), so links point back at the endpoint the client actually hit.

The wire contract — routes, envelope, status codes, option shape — matches the bundled `node:http` handler (`dynamodb-toolkit/handler`) and the sibling `dynamodb-toolkit-koa`; only the I/O translation differs.

## Layout

```
src/
  index.js        # createExpressAdapter — the single middleware factory
  index.d.ts      # Type + doc sidecar (sole source of types and docs)
tests/            # Unit + mock-based tests (tape-six); fake req/res fixtures
llms.txt          # Machine-readable API reference (consumer-facing)
llms-full.txt
wiki/             # Published wiki — git submodule
```

The published tarball ships `src/`, `README.md`, `LICENSE`, `llms.txt`, `llms-full.txt`, `package.json`. Tests, AI-rule files, and the wiki stay out (verify via `npm pack --dry-run`).
