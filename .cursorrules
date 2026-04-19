# AGENTS.md — dynamodb-toolkit-express

Canonical rules and conventions for AI agents and contributors. Mirrored byte-identical to `.cursorrules`, `.windsurfrules`, `.clinerules`.

## What this package is

A thin Express adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Mounts the toolkit's standard REST route pack as Express middleware. Same wire contract as the bundled `node:http` adapter (`dynamodb-toolkit/handler`), translated for Express's `(req, res, next)` shape.

## Posture

- **Zero runtime dependencies.** `dynamodb-toolkit` and `express` are `peerDependencies`. Anything in `dependencies` is a bug.
- **ESM-only.** `"type": "module"`. Hand-written `.d.ts` sidecars next to every `.js` file. No build step.
- **Thin.** Framework adapter, not framework. Delegates parsing / envelope building / policy to `dynamodb-toolkit/rest-core`. Delegates route-shape matching to `dynamodb-toolkit/handler`'s `matchRoute`. The adapter's job is req/res translation + error mapping.
- **Node 20+** target. Express 4 and 5 both supported (peer range `^4.21.0 || ^5.0.0`). Bun / Deno compat depends on Express itself.

## Scripts

| Command                             | What it does                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| `npm install`                       | Install dependencies                                                 |
| `npm test`                          | Run unit suite via tape-six (Node)                                   |
| `npm run test:deno`                 | Manual — same suite under Deno (contingent on Express's Deno compat) |
| `npm run test:bun`                  | Manual — same suite under Bun                                        |
| `npm run ts-test`                   | Manual — run TypeScript test files (`tests/test-*.*ts`) via tape-six |
| `npm run ts-check`                  | Strict `tsc --noEmit` over `.ts` / `.d.ts` files                     |
| `npm run js-check`                  | `tsc --project tsconfig.check.json` — JS lint via type-checker       |
| `npm run lint` / `npm run lint:fix` | Prettier check / fix                                                 |

There is no build step. The published tarball ships `src/` as-is plus `llms.txt` + `llms-full.txt`.

## Project structure

```
dynamodb-toolkit-express/
├── src/                       # Published code (ESM .js + .d.ts sidecars)
│   ├── index.js / index.d.ts  # Main entry — exports the adapter factory
│   └── (sub-modules as they grow)
├── tests/
│   ├── test-*.js              # Unit + mock-based tests (default `npm test`)
│   └── helpers/               # Fake req/res + shared test fixtures
├── llms.txt / llms-full.txt   # AI-readable API reference
└── .github/workflows/tests.yml
```

The published tarball includes only `src/` + `README.md` + `LICENSE` + `llms.txt` + `llms-full.txt` + `package.json`.

## Cross-project conventions (inherited from dynamodb-toolkit)

- **Do not import `node:*` modules at runtime in `src/`.** Type-only imports in `.d.ts` are fine. Tests may use `node:*` freely. Express itself uses `node:http` — that's the consumer's problem, not the adapter's.
- **Prettier** enforces formatting (`.prettierrc`). Run `npm run lint:fix` before commits.
- **JSDoc `@param` + `@returns`** on every exported symbol in the `.d.ts` sidecars. Semantic `@returns` on non-void returns is mandatory.
- **Arrow functions and FP style.** Prefer `=>` unless `this` is needed. Lightweight objects over classes.
- **No `any` in TypeScript.** Use proper types or `unknown`.

## Release posture

See `.claude/commands/release-check.md` for the full checklist. Commit, tag, and `npm publish` are user-driven.
