# dynamodb-toolkit-express [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-express.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-express

Express adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Mounts the toolkit's standard REST route pack as an Express middleware — same wire contract as `dynamodb-toolkit/handler` (the bundled `node:http` adapter) and [`dynamodb-toolkit-koa`](https://github.com/uhop/dynamodb-toolkit-koa), translated for Express.

> **Status: scaffolding.** Implementation to follow. Sibling package `dynamodb-toolkit-koa@0.1.0` is the structural reference.

## Install

```sh
npm install dynamodb-toolkit-express dynamodb-toolkit express @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

`dynamodb-toolkit` and `express` are declared as **peer dependencies**.

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

The adapter serves the [standard route pack](https://github.com/uhop/dynamodb-toolkit/wiki/HTTP-handler) — envelope keys, status codes, and prefixes all configurable via `options.policy`.

## Compatibility

- **Express 4** and **Express 5** (peer dep range `^4.21.0 || ^5.0.0`).
- **Node 20+**; cross-runtime test matrix (Deno / Bun) TBD — depends on Express's own compat.

## License

[BSD-3-Clause](LICENSE).
