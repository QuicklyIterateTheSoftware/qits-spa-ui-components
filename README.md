# qits-spa-ui-components

The shared Angular component library for qits frontends, published as **`@qits/ui-components`**.

Standalone components with typed inputs, `OnPush` change detection and self-contained styles.
Nothing here fetches or stores: a component that needed data would belong to the app that has it.

| Component | Selector | What it is |
|---|---|---|
| `QitsButton` | `<qits-button>` | The button. `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `type`, `disabled`, `busy`; emits `pressed`. |
| `QitsBadge` | `<qits-badge>` | A short status word. Required `label`, semantic `tone` (`neutral`/`info`/`success`/`warning`/`danger`). |
| `QitsCard` | `<qits-card>` | A titled surface. `heading`, `subheading`, `elevated`; projects into the body, and `[qitsCardActions]` into the header. |
| `QitsMainLayout` | `<qits-main-layout>` | The application skeleton. `brand`, `links` (defaulting to `QITS_NAV_LINKS`); holds the `<router-outlet />` the app's child routes render into. |

`busy` is separate from `disabled` on purpose: both stop a press, but only `busy` sets
`aria-busy`, so a host can say "working…" without also claiming the action is unavailable. Tones
are semantic names rather than colours, which keeps a restyle of the whole system inside this
repository.

`QitsMainLayout` is the one component with a peer beyond `@angular/core` and `@angular/common`: it
renders a `<router-outlet />`, so `@angular/router` is a peer too. Mount it as the root *route*
component, never as a tag around your content —

```ts
export const routes: Routes = [
  { path: '', component: QitsMainLayout, children: [/* the app */] },
];
```

— and the chrome survives navigation while only the outlet changes. Its breakpoint is CSS, not a
media query in TypeScript: a persistent sidebar from 768px up, a burger in the top bar below it,
and the burger is the only state the component keeps. The links in `QITS_NAV_LINKS` are plain
`<a href>` paths rather than routes, because every destination is a *different* Angular application
behind its own base path — `routerLink` would compile and go nowhere. The entry matching the app's
own `document.baseURI` is marked `aria-current="page"`. Pass your own `links` to reorder the list
or splice entries into it.

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
    pnpm lint            # eslint + angular-eslint, the qits- selector prefix enforced
    pnpm test            # vitest under jsdom
    pnpm build           # ng-packagr → dist/qits-spa-ui-components, then check-exports
    pnpm storybook       # the component workbench on :6006
    pnpm build-storybook # the same, static, into storybook-static/

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

### Storybook

Storybook is the place to *look* at a component, which is the one thing a jsdom spec cannot do.
Both targets live in `angular.json` and run through **`@storybook/angular-vite`**: this workspace
builds on Vite under Angular 21, and the webpack-era `@storybook/angular` would mean a second
toolchain disagreeing with the first. The config is `projects/qits-spa-ui-components/.storybook`.

Stories sit next to the component they document, as `src/lib/<component>.stories.ts` — the same
place the specs sit. `tsconfig.lib.json` excludes both `*.spec.ts` and `*.stories.ts`, so neither
reaches the published package; `pnpm build` output stays the five files it always was.

Property tables come from **compodoc**, which the framework runs before either target and which
reads the components' own JSDoc and `input()` signatures into a gitignored `documentation.json`.
That is why the doc comments in `src/lib` are worth keeping accurate: they are the docs.

`pnpm build-storybook` runs in the pipeline too. It ships nothing — `storybook-static/` is
gitignored and dies with the container — but it compiles every story, the `.storybook` config and
the compodoc pass, so a broken workbench surfaces on push rather than the next time someone opens
it. Like the build it is Vite compiling, not a browser rendering, so the browserless CI image is
enough.

## Releasing

Two pipelines publish, and they publish different things.

`.config/qits/ci-post-receive.yml` runs on every push to `main`. It installs, lints, tests, builds
and publishes `<last released version>-main.g<sha7>` under the **`main`** dist-tag — a build of the
branch, named so nobody mistakes it for a release. The explicit `--tag main` is load-bearing: a bare
`npm publish` would move `latest` to a prerelease.

`.config/qits/ci-event-release.yml` is the release pipeline. It reacts to this repository's own
`SCMRelease`, checks out the annotated tag the release push created, builds it and publishes the
real version under `latest`. Both publish **if absent** — published versions are immutable and an
event can be redelivered, so a second run of one release goes green rather than fighting the
registry.

The release train runs through this library. `SCMRelease` says only that source control has the
version; `SoftwareRelease` is what qits-ci publishes when the release pipeline goes green, and it
means the tarball is in the registry. Consumers trigger on the second one, so a bump pipeline can
install what it was told about (scm-release-split-plan.md).
