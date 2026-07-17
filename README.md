# dynamodb-toolkit-express [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-express.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-express

> **Superseded.** The Express adapter now ships inside [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) as the **`dynamodb-toolkit/express`** subpath export (3.8.0+). This package is a **frozen re-export thunk**: it keeps existing consumers working unchanged and receives no further development. The repository is archived.

## Migration

Change the import — nothing else:

```diff
-import {createExpressAdapter} from 'dynamodb-toolkit-express';
+import {createExpressAdapter} from 'dynamodb-toolkit/express';
```

Then drop `dynamodb-toolkit-express` from your `package.json`. The API, options, and wire contract are identical — the code simply lives in the core package now (Express remains duck-typed at runtime; the core stays zero-dependency).

## What this thunk is

`export * from 'dynamodb-toolkit/express'` — nothing else. It declares an open-ended peer on `dynamodb-toolkit >= 3.8.0`, so future core releases never require a thunk update.

Documentation lives in the core wiki: [Framework adapters](https://github.com/uhop/dynamodb-toolkit/wiki/Framework-adapters) (shared surface) and [Express adapter](https://github.com/uhop/dynamodb-toolkit/wiki/Express-adapter).

## Release notes

- 0.4.0 _Frozen re-export thunk over `dynamodb-toolkit/express`; superseded by the core subpath. No API changes._
- 0.3.0 _Standalone adapter line (final implementation release); see the core wiki for current docs._

Full details in the wiki's [Release notes](https://github.com/uhop/dynamodb-toolkit-express/wiki/Release-notes).

## License

[BSD-3-Clause](LICENSE).
