# Architecture — dynamodb-toolkit-express (frozen thunk)

Since 0.4.0 this package is a re-export thunk over the core package's
`dynamodb-toolkit/express` subpath. There is no implementation here:

- `src/index.js` — `export * from 'dynamodb-toolkit/express'` (ESM, `@ts-self-types` sidecar convention).
- `src/index.d.ts` — the matching type re-export.
- `tests/` — verify the re-export surface matches the core subpath (identity per symbol) plus `require(esm)` interop and a typed smoke.

The real architecture is documented in the core repo's `ARCHITECTURE.md`
(module `http/` — ports over a shared neutral-result engine). The pre-thunk
standalone implementation is preserved in git history at tags ≤ 0.3.0.
