# AGENTS.md

**This package is a frozen re-export thunk.** The Express adapter's source of
truth is the core repo — `dynamodb-toolkit`'s `src/http/express/` (public
subpath `dynamodb-toolkit/express`). Do not add features here; make changes in
the core. The only legitimate change to this repo is a new thunk release that
still only re-exports.

## Commands

- `npm test` / `npm run test:bun` / `npm run test:deno` — thunk identity + smoke tests
- `npm run ts-check` / `npm run js-check` — type checks
- `npm run lint` / `npm run lint:fix` — prettier

## Structure

- `src/index.js` + `src/index.d.ts` — `export * from 'dynamodb-toolkit/express'`
- `tests/` — re-export identity (`test-thunk.js`) + smoke tests (`.js`, `.cjs`, `.ts`)

Peer: `dynamodb-toolkit >= 3.8.0` (open-ended). The pre-thunk implementation
history is in git (tags ≤ 0.3.0); current adapter docs are in the core wiki.
