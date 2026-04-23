# dynamodb-toolkit-express [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-express.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-express

Express adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Mounts the toolkit's standard REST route pack as an Express middleware — same wire contract as `dynamodb-toolkit/handler` (the bundled `node:http` adapter) and [`dynamodb-toolkit-koa`](https://github.com/uhop/dynamodb-toolkit-koa), translated for Express's `(req, res, next)` shape.

Zero runtime dependencies; `express` and `dynamodb-toolkit` are peer dependencies.

## Install

```sh
npm install dynamodb-toolkit-express dynamodb-toolkit express @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Quick start

```js
import express from 'express';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {Adapter} from 'dynamodb-toolkit';
import {createExpressAdapter} from 'dynamodb-toolkit-express';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({region: 'us-east-1'}));

const adapter = new Adapter({
  client,
  table: 'planets',
  keyFields: ['name']
});

const app = express();
app.use(express.json());
app.use('/planets', createExpressAdapter(adapter));
app.listen(3000);
```

`app.use(prefix, middleware)` is the idiomatic way to mount the adapter at a sub-path — Express strips the prefix from `req.path` natively. Unrecognized routes hand back to `next()`, so the adapter composes cleanly with the rest of your Express stack.

## Options

| Option               | Default                                      | Purpose                                                                                       |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `policy`             | `defaultPolicy`                              | Partial overrides for prefixes, envelope keys, status codes.                                  |
| `sortableIndices`    | `{}`                                         | Map sort-field name → GSI name for `?sort=` / `?sort=-field`.                                 |
| `keyFromPath`        | `(raw, a) => ({[a.keyFields[0].name]: raw})` | Convert `:key` path segment to a key object (composite keys).                                 |
| `exampleFromContext` | `() => ({})`                                 | Derive `prepareListInput` `example` from `{query, body, adapter, framework: 'express', req}`. |
| `maxBodyBytes`       | `1048576` (1 MiB)                            | Cap for stream-parsed bodies, measured in bytes (ignored when a body-parser ran).             |

Consumers using `express.json()` (or any compatible body-parser) can rely on the pre-parsed `req.body`; the adapter uses it when set, falls back to streaming the raw request otherwise.

## Routes

Rooted at the mount point:

| Method | Path               | Adapter method                |
| ------ | ------------------ | ----------------------------- |
| GET    | `/`                | `getList` (envelope + links)  |
| POST   | `/`                | `post`                        |
| DELETE | `/`                | `deleteListByParams`          |
| GET    | `/-by-names`       | `getByKeys`                   |
| DELETE | `/-by-names`       | `deleteByKeys`                |
| PUT    | `/-load`           | `putItems`                    |
| PUT    | `/-clone`          | `cloneListByParams` (overlay) |
| PUT    | `/-move`           | `moveListByParams` (overlay)  |
| PUT    | `/-clone-by-names` | `cloneByKeys` (overlay)       |
| PUT    | `/-move-by-names`  | `moveByKeys` (overlay)        |
| GET    | `/:key`            | `getByKey`                    |
| PUT    | `/:key`            | `put` (URL key merged in)     |
| PATCH  | `/:key`            | `patch` (meta keys → options) |
| DELETE | `/:key`            | `delete`                      |
| PUT    | `/:key/-clone`     | `clone`                       |
| PUT    | `/:key/-move`      | `move`                        |

Wire contract — query syntax, envelope shape, meta-key prefixes, status codes — matches the bundled [HTTP handler](https://github.com/uhop/dynamodb-toolkit/wiki/HTTP-handler). Everything is configurable through `options.policy`.

## Compatibility

- **Express 4** and **Express 5** (peer range `^4.21.0 || ^5.0.0`).
- **Node 20+**, **Bun**, **Deno** — the adapter's tests run cleanly under all three.

## License

[BSD-3-Clause](LICENSE).
