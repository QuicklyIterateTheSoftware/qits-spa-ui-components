# qits-spa-ui-components

The shared Angular component library for qits frontends, published as **`@qits/ui-components`**.

Standalone components with typed inputs, `OnPush` change detection and self-contained styles.
Nothing here fetches or stores: a component that needed data would belong to the app that has it.

**One exception, and only one: `QitsMainLayout` asks the platform what the platform contains.** The
rule holds because it is about *ownership* — a component must not go looking for data some
application already has. The chrome is the case where no application has it. What the platform
routes is known to the gateway and to nothing else; each SPA knows only itself. So the navigation
arrives over `QITS_NAVIGATION`, which `provideQitsNavigation()` answers with one `GET
/main-navigation`. Everything else in this package still takes what it renders as an input.

| Component | Selector | What it is |
|---|---|---|
| `QitsButton` | `<qits-button>` | The button. `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `type`, `disabled`, `busy`; emits `pressed`. |
| `QitsBadge` | `<qits-badge>` | A short status word. Required `label`, semantic `tone` (`neutral`/`info`/`success`/`warning`/`danger`). |
| `QitsCard` | `<qits-card>` | A titled surface. `heading`, `subheading`, `elevated`; projects into the body, and `[qitsCardActions]` into the header. |
| `QitsPicker` | `<qits-picker>` | Pick one of a list. Required `options` (`{ value: T, label: string }[]`), two-way `value` of `T \| undefined`; `compareWith`, `placeholder`, `disabled`. |
| `QitsMainLayout` | `<qits-main-layout>` | The application skeleton. `brand`, `links` (an override; the navigation comes from `QITS_NAVIGATION`); holds the `<router-outlet />` the app's child routes render into. |
| `QitsNavSubmenu` | `[qitsNavSubmenu]` | Marks an `<ng-template>` as the sub-menu under the current navigation entry. The layout gives it a box; the app styles what goes in it. |

`busy` is separate from `disabled` on purpose: both stop a press, but only `busy` sets
`aria-busy`, so a host can say "working…" without also claiming the action is unavailable. Tones
are semantic names rather than colours, which keeps a restyle of the whole system inside this
repository.

In `QitsPicker` the list **is** the empty state: with nothing chosen the options stand open in the
flow of the page, and choosing one collapses them into the bar above beside a clear button that
puts them back. There is no closed-and-empty state, so nobody has to open anything to see what
they can pick. A rail down the left of the bar and the rows carries a caret: half opacity where
the pointer or the arrow keys are resting, full opacity once the choice is locked into the bar.

```ts
type Env = { id: string };
const environments: QitsPickerOption<Env>[] = [
  { value: { id: 'dev' }, label: 'Development' },
  { value: { id: 'prod' }, label: 'Production' },
];
```
```html
<qits-picker [options]="environments" [(value)]="env" [compareWith]="sameId" />
```

`value` is a `model`, so `[(value)]` binds both ways and `(valueChange)` alone is the output —
`T | undefined`, the second half meaning cleared. Values are matched with `Object.is` unless
`compareWith` says otherwise, which is what objects that crossed a serialisation boundary need. A
`value` matching no option shows the list, because the component cannot render a label it was not
given. The rows follow the ARIA listbox pattern: the list is one tab stop, arrows and `Home`/`End`
move the caret, `Enter` picks.

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
and the burger is the only state the component keeps. The entries are plain `<a href>` paths rather
than routes, because every destination is a *different* Angular application behind its own base
path — `routerLink` would compile and go nowhere. The entry matching the app's own
`document.baseURI` is marked `aria-current="page"`.

### Where the links come from

```ts
bootstrapApplication(App, {
  providers: [provideHttpClient(), provideRouter(routes), provideQitsNavigation()],
});
```

`provideQitsNavigation()` issues one `GET /main-navigation` for the life of the application and
gives the answer — `{"links":[{"label":"Home","href":"/"},…]}` — to the layout. The URL is
**absolute**, deliberately unlike the platform's `api/config.json` convention of a SPA reading from
its own backend: the gateway is the only process that knows what the platform routes, and the only
one with no path segment of its own. It requires `provideHttpClient()`; it provides nothing else.

`provideQitsNavigationLinks([…])` answers the same contract from a literal, for specs, stories and
an `ng serve` with no gateway in front of it. Nothing is fetched, so there is no request to flush
and no pending task to wait on.

Three states, and no compiled-in list behind any of them:

- **waiting** — no entries, and `aria-busy` on the `<nav>`;
- **answered** — the entries, as above;
- **stranded** (empty answer, request failed, or no provider at all) — one link to `/` under a
  "Navigation unavailable" line. `/` is the gateway's own root rather than a registry entry, so it
  is the one destination that cannot go stale.

A fallback list compiled in here would put back the drift this replaced *and hide it*: the chrome
would sometimes show what the platform routes and sometimes a guess frozen at release time, with
nothing on screen telling them apart.

`[links]` is an explicit override. A **non-empty** list wins outright and the source is not
consulted, which is what lets a story or a spec render the real chrome with no provider anywhere.
Empty — the default — means "ask".

### The sub-menu

An application can hang its own menu under its own entry: a documentation tree, a version picker.
Declare it **in the app shell, beside the `<router-outlet />`** —

```html
<ng-template qitsNavSubmenu><app-doc-tree /></ng-template>
<router-outlet />
```

— and never inside a page. Getting that wrong is silent: a page's declaration is destroyed and
rebuilt on every navigation, so the panel would lose its scroll position and every open group on
each hop, in a menu that did not itself change. The layout renders it in a bare block and styles
nothing inside it, and the content keeps the shell's style scope, because view encapsulation
follows where a node is declared rather than where it is inserted. Where no entry is this
application — the gateway does not route it yet, a bare `ng serve` — the sub-menu goes to the foot
of the navigation instead of nowhere.

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

### Pinning a `main` build takes an exact version, never a caret

A build off `main` is published as `<last released version>-main.g<sha7>` (see *Releasing*), and a
consumer reaching for one ahead of its release must spell it **exactly**:

    "@qits/ui-components": "2026.806.184725-main.gc03ad30"     # yes
    "@qits/ui-components": "^2026.806.184725-main.gc03ad30"    # no

The caret range admits `2026.806.184725` as well — a prerelease sorts *below* the release it is
named after, so npm resolves the release and never mentions the prerelease again. What arrives is
the build the caller was trying to get ahead of, and the failure lands somewhere else entirely:
`error TS2305: Module '@qits/ui-components' has no exported member 'QitsPicker'`.

The trap is quiet because the caret usually works. It did for the first client to pin a `main`
build — but only because no stable release of that version existed yet for the range to prefer.
The moment one did, every caret pin silently moved backwards.

A pin like this is temporary by nature. Once the release lands, the range goes back to an ordinary
`^<version>`, and the maintenance-hop pipelines described in *Releasing* write exactly that.

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

The layout no longer carries a list of the platform's doors. It asks the gateway, which derives the
answer from the routes it actually serves — so a component appearing, moving or being retired is one
deployment of one process, not a release here and a bump in nine SPAs.
