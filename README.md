# qits-spa-ui-components

The shared Angular component library for qits frontends, published as **`@qits/ui-components`**.

Everything here is *presentational*: standalone components with typed inputs, `OnPush` change
detection, self-contained styles and no dependency beyond `@angular/core` and `@angular/common`,
both declared as peers. Nothing in this library fetches, routes, stores or knows a URL — a
component that needed any of those would belong to the app that has them.

| Component | Selector | What it is |
|---|---|---|
| `QitsButton` | `<qits-button>` | The button. `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `type`, `disabled`, `busy`; emits `pressed`. |
| `QitsBadge` | `<qits-badge>` | A short status word. Required `label`, semantic `tone` (`neutral`/`info`/`success`/`warning`/`danger`). |
| `QitsCard` | `<qits-card>` | A titled surface. `heading`, `subheading`, `elevated`; projects into the body, and `[qitsCardActions]` into the header. |

`busy` is separate from `disabled` on purpose: both stop a press, but only `busy` sets
`aria-busy`, so a host can say "working…" without also claiming the action is unavailable. Tones
are semantic names rather than colours, which keeps a restyle of the whole system inside this
repository.

## Install

`@qits/ui-components` lives in the platform's own npm repository, not on npmjs. A consumer needs
one `.npmrc` next to its `package.json` — the scope routing, nothing else:

    registry=http://localhost:8081/artifacts/npm/npmjs/     # everything, through the npmjs cache
    @qits:registry=http://localhost:8081/artifacts/npm/npm/ # ours

    pnpm add @qits/ui-components

Those are the addresses of a local platform as published on the deployment host. Inside qits-net —
a CI step, another container — the same two roots are `http://qits-artifacts:8080/artifacts/npm/…`,
and CI writes them from environment rather than reading any file (see
`.config/qits/ci-post-receive.yml`). Neither registry wants a credential.

The published package is the **prebuilt ng-packagr output** — FESM bundles and type definitions, in
Angular's partial compilation format. There is nothing to compile on install and no `prepare` hook;
consumers install a tarball like any other dependency.

Then, in a standalone component:

```ts
import { QitsBadge, QitsButton, QitsCard } from '@qits/ui-components';

@Component({
  imports: [QitsButton, QitsBadge, QitsCard],
  template: `
    <qits-card heading="Latest run" subheading="main @ 18f7422" elevated>
      <qits-button qitsCardActions size="sm" variant="secondary" (pressed)="rerun()">
        Re-run
      </qits-button>
      <qits-badge label="SUCCESS" tone="success" />
    </qits-card>
  `,
})
export class RunSummary { /* … */ }
```

## Development

    pnpm install
    pnpm lint          # eslint + angular-eslint, the qits- selector prefix enforced
    pnpm test          # vitest under jsdom
    pnpm build         # ng-packagr → dist/qits-spa-ui-components, then check-exports

`pnpm build` runs `scripts/check-exports.mjs` over the output: it is the manifest ng-packagr
*writes* that gets published, so the check reads that one — the package name, the version against
`projects/qits-spa-ui-components/package.json`, the absence of a `private` flag, the peer ranges,
and that every path in `exports` exists on disk. A publish that would have failed after a green
pipeline fails at build time instead.

The workspace root is a harness: its `package.json` is `private: true` and carries only tooling.
The publishable unit is `dist/qits-spa-ui-components`, and
`projects/qits-spa-ui-components/package.json` is the single source of truth for the package's
name, version and dependencies.

Tests run browserless, in jsdom, which is enough for rendering, inputs, projection and emitted
events. A component that genuinely needs a layout engine gets a `.browser.spec.ts` — the `test`
target already excludes that suffix — and a `test-browser` target running vitest browser mode;
until a build image ships a browser, that target is a local-only affair and CI stays on `pnpm test`.

## Releasing

Push to `main` and the pipeline in `.config/qits/ci-post-receive.yml` installs, lints, tests,
builds and then **publishes if absent**: it reads the version from
`projects/qits-spa-ui-components/package.json`, asks the registry whether that version exists, and
publishes only when it does not. So a release is an ordinary version-bump commit, and every other
push — a doc fix, a re-run — stays green without touching the registry. Published versions are
immutable; there is no unpublish.
