# StackBlitz / WebContainers development

## What the reported error means

`Invariant: Expected workUnitAsyncStorage to have a store` is a Next.js request-context invariant (E696). The same failure in Next 15.5.x on WebContainers is tracked upstream:

- https://github.com/stackblitz/webcontainer-core/issues/1978
- https://github.com/vercel/next.js/issues/84026

The ESLint deprecation and experimental WASI messages are not this exception. Reinstalling dependencies or clearing a build cache alone is not a demonstrated fix for this runtime incompatibility. The error message alone does not prove which scheduler or module lost the context.

## Mitigation in this project (not a guaranteed upstream fix)

`npm run dev` goes through a small launcher (`scripts/stackblitz/dev.mjs`) that picks the mode automatically:

- **Plain mode** (ordinary machines): runs `next dev` exactly as before — no probes, no env changes.
- **Mitigation mode** (WebContainers, e.g. StackBlitz/Bolt.new): detected via `process.versions.webcontainer`, the `@blitz/internal/env` module, `WEBCONTAINER=1`, or a `/home/projects/` working directory. It first runs the async-context probes, then starts Next with a preload **before Next is imported**, inherited by its child processes. The preload binds callbacks scheduled through `queueMicrotask`, `setImmediate` and `setTimeout` to their scheduling async context, using `node:async_hooks`'s `AsyncResource.bind`.

Overrides (documented in `scripts/stackblitz/mode.mjs`): `ROSIE_STACKBLITZ=1` or `npm run dev:stackblitz` force mitigation mode anywhere; `ROSIE_STACKBLITZ=0` forces plain mode. The `stackblitz` field in `package.json` sets `ROSIE_STACKBLITZ=1` for StackBlitz top-level shells, so a plain import already takes the safe path.

This targets callback context loss. It does **not** fix every possible WebContainer AsyncLocalStorage implementation issue or duplicate Next module instance. It never invents a store, catches/ignores Next's invariant, shares a global user's request, changes authentication, or downgrades Next/React to an older vulnerable release.

The launcher checks concurrent/nested contexts across promises, microtasks, timers, filesystem I/O and snapshots before starting Next. It stops on a failing probe. Passing these probes does not by itself certify React SSR in WebContainers.

Native image optimisation is disabled **only in this opt-in development mode**; the browser loads source images. Production and ordinary Node development keep their existing settings. Native server-side upload/media processing may still require a real Node runtime; this is not an all-features browser port.

## Apply to the existing StackBlitz project

The compatibility source files are included directly in branch `arena/01a0e3c7-rozalit`; no ZIP extraction is needed when importing that revision.

- [GitHub source branch](https://github.com/milpardi42-max/rozalit/tree/arena/01a0e3c7-rozalit)
- [Open that branch in StackBlitz](https://stackblitz.com/github/milpardi42-max/rozalit/tree/arena/01a0e3c7-rozalit)

The branch includes `package.json`, `next.config.ts`, `.stackblitzrc`, all five files in `scripts/stackblitz/`, and the runtime regression tests. `.stackblitzrc` selects `npm run dev:stackblitz` on import. An already-open StackBlitz copy will not automatically acquire new GitHub commits; import the updated branch or sync these files first. A plain repository import still uses the default branch until the pull request is merged.

No secrets, runtime customer data or credentials should be copied/shared.

Stop the old process with **Ctrl+C**, then run in the StackBlitz terminal:

```sh
npm install
npm run clean:next
npm run dev:stackblitz
```

Do not run `npx next dev` for this mitigation: it bypasses the launcher/preload.

`clean:next` removes only `.next` and `dist/.next`. Stop the dev server first. It does not delete `data/`, uploads, environment files or `package-lock.json`.

In a **second terminal**, leaving the server running:

```sh
npm run smoke:stackblitz
```

Use `SMOKE_ORIGIN=http://localhost:3001 npm run smoke:stackblitz` if Next reports another port. Visit `/fa` in the browser as well; test navigation, login and the UI you use. The HTTP test alone doesn't validate hydration or all native features.

For an unmodified runtime diagnostic:

```sh
npm run diagnose:stackblitz
```

## If E696 persists

Share the full error stack, the `[StackBlitz check]` output, and `smoke:stackblitz` results (without `.env` values). This sandbox does not provide the user's WebContainer runtime, so a claim of a verified 100% StackBlitz fix would be inaccurate. Use the working Node.js preview or a real Node environment such as GitHub Codespaces for a dependable full-server runtime while the upstream issue remains unresolved. Do not downgrade to 15.4.1/15.4.7 or remove Next's request/auth checks as a shortcut.

## Checks actually performed here

- Normal Node and opt-in preload context diagnostics: pass on Node 22.22.3.
- Simulated context-dropping scheduler: binding restores two independent nested stores across 40 concurrent operations.
- Cancellation, timer arguments, promisify hooks, idempotence, child inheritance, and no activation in production: pass.
- Opt-in Next dev: `/fa`, `/en`, `/fa/portfolio`, `/fa/artists`, `/api/auth/me` return 200; unauthenticated `/api/admin/stats` returns 401.
- All 22 repository tests pass. TypeScript and ESLint have no errors (existing warnings remain).
- **Not performed:** execution inside the user's actual StackBlitz/WebContainer project.
