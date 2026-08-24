# qits-spa-ui-components

The shared Angular component library for qits frontends, published as **`@qits/ui-components`**.

Standalone components with typed inputs, `OnPush` change detection and self-contained styles.
Nothing here fetches or stores: a component that needed data would belong to the app that has it.

**One exception, and only one: `QitsMainLayout` asks the platform what the platform contains.** The
rule holds because it is about _ownership_ — a component must not go looking for data some
application already has. The chrome is the case where no application has it. What the platform
serves is known to the edge and to nothing else; what a project holds is known to qits-projects; and
each SPA knows only itself. So the chrome makes three reads, and everything else in this package
still takes what it renders as an input.

| Component        | Selector             | What it is                                                                                                                                                                                                                      |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `QitsButton`     | `<qits-button>`      | The button. `variant` (`primary`/`secondary`/`ghost`), `size` (`sm`/`md`/`lg`), `type`, `disabled`, `busy`; emits `pressed`.                                                                                                     |
| `QitsBadge`      | `<qits-badge>`       | A short status word. Required `label`, semantic `tone` (`neutral`/`info`/`success`/`warning`/`danger`).                                                                                                                          |
| `QitsCard`       | `<qits-card>`        | A titled surface. `heading`, `subheading`, `elevated`; projects into the body, and `[qitsCardActions]` into the header.                                                                                                          |
| `QitsPicker`     | `<qits-picker>`      | Pick one of a list. Required `options` (`{ value: T, label: string }[]`), two-way `value` of `T \| undefined`; `compareWith`, `placeholder`, `disabled`.                                                                         |
| `QitsMainLayout` | `<qits-main-layout>` | The application skeleton: the project picker, the nested sidebar, and the `<router-outlet />` the app's child routes render into. `brand` is the top-left fallback; `links` an override in the flat shape.                        |
| `QitsNavSubmenu` | `[qitsNavSubmenu]`   | Marks an `<ng-template>` as the sub-menu under the current navigation row. The layout gives it a box; the app styles what goes in it.                                                                                            |

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

## The URL is the single source of truth

Every service on this platform is its own host, and every SPA under it shares one grammar:

    https://<app>.<env>.<domain>/<projectSlug>/<category>/<repoName>/…   a repository
    https://<app>.<env>.<domain>/<projectSlug>/…                         a project
    https://<app>.<env>.<domain>/…                                       the platform

The six categories are `services daemons libs frontends cli images`. `parseScope` reads that
grammar and nothing else:

```ts
parseScope('/qits/services/qits-ci/runs/1'); // { project: 'qits', category: 'services', repository: 'qits-ci' }
parseScope('/traces'); //                       {} — an application's own page
parseScope('/qits/epics/1', knownSlugs); //     { project: 'qits' } — because the platform has that slug
```

**Segment one is a project only when the URL proves it**: either segment two is a category, or the
project list the chrome already loaded contains the slug. That rule is what lets every SPA keep its
own top-level routes. A project is never a category either, so `/services` stays this app's own
page — and qits-projects refuses a slug that spells a category or a routed segment, so the two
vocabularies cannot collide from the other side.

`scopePath(scope)` gives the directory form (`/`, `/qits/`, `/qits/services/qits-ci/`) and
`scopeCommands(scope)` the same prefix as router commands, for an in-app absolute link:

```ts
router.navigate([...scopeCommands(scope()), 'runs', id]);
```

Both are pure functions of a `QitsScope`, so a route guard, a spec and the chrome answer the same
question the same way.

## The three reads

```ts
bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    provideQitsNavigation(), //   GET /main-navigation        — what the platform serves
    provideQitsProjects(), //     GET /projects/api/projects  — and its repositories, per project
    provideQitsScope('repository'), // the address, as this application routes it
  ],
});
```

All three URLs are **absolute**, deliberately unlike the platform's `api/config.json` convention of
a SPA reading from its own backend. Every SPA is served same-origin behind the edge, so an absolute
path is not a shortcut: it is what carries the browser's session cookie to the service that owns the
answer, with no machine token and no CORS pre-flight. A SPA asking its own backend would be asking a
service that knows what it does and nothing about what is deployed beside it.

**`provideQitsNavigation()`** issues one `GET /main-navigation` for the life of the application. The
edge answers with slots — one entry per application, filed under where it belongs in the chrome:

```json
{
  "environment": "dev",
  "origin": "https://dev.example.com",
  "slots": {
    "system": [{ "app": "qits-projects", "label": "Overview", "host": "projects", "path": "/projects", "origin": "https://projects.dev.example.com", "position": 1 }],
    "platform": [{ "app": "qits-platform-events", "label": "Events", "host": "events", "path": "/events", "origin": "https://events.dev.example.com", "position": 1 }],
    "project.detail": [{ "app": "qits-workspaces", "label": "Workspaces", "host": "workspaces", "path": "/workspaces", "origin": "https://workspaces.dev.example.com", "position": 1 }],
    "services.details": [{ "app": "qits-ci", "label": "CI", "host": null, "path": "/ci", "origin": "https://dev.example.com", "position": 2 }]
  }
}
```

Every entry carries both `host` and `path`, and the last one above is an application the platform
does not serve on a host of its own yet: `host: null`, the environment origin, and `/ci` as the
segment it answers on there. `HttpNavigationSource` normalises the payload into a `QitsNavTree`:
every slot flattened into one list sorted by position then label, each entry carrying its slot and
its path prefix, plus the environment origin. An edge
that predates slots answers the flat `{"links":[…]}` shape instead, and the tree carries it as
`legacy` — set **only** when no slots were served, because the two are exclusive: `legacy` means
"this platform cannot tell me its shape", and the sidebar then draws the flat list it always drew.

`provideQitsNavigationTree(payload)` and `provideQitsNavigationLinks([…])` answer the same contract
from a literal — specs, stories, an `ng serve` with no platform in front of it. Nothing is fetched,
so there is no request to flush and no pending task to wait on.

**`provideQitsProjects()`** issues one `GET /projects/api/projects` and installs
`QITS_REPOSITORIES` beside it: the repositories of whatever project is in scope, one `GET
/projects/api/projects/{id}/repositories` per project and none at all while none is open. Leaving a
project cancels a read still in flight. The archetype table — `SERVICE`→`services`,
`DAEMON`→`daemons`, `LIBRARY`→`libs`, `FRONTEND`→`frontends`, `CLI`→`cli`, `IMAGE`→`images` — is
**copied** here rather than imported: this library depends on no qits module, and a repository whose
archetype it does not know is left out of the groups rather than filed under a guess.
`provideQitsProjectList([…])` and `provideQitsRepositoryList([…], wrapperId)` are the literal forms.

**`provideQitsScope(routing)`** installs `UrlScope`, which reads the address and nothing else — no
storage, deliberately. A remembered pick would make the same URL render differently for two people
and would silently re-scope a page opened from a bookmark. `routing` says how deep this
application's own addresses go:

| `routing`      | the applications                            | what a pick does                           |
| -------------- | ------------------------------------------- | ------------------------------------------ |
| `'repository'` | ci, docs, artifacts, configuration, workspaces | goes to `/<slug>` on this host           |
| `'project'`    | events, deployments, observability, maintenance | goes to `/<slug>` on this host          |
| `'system'`     | mirror, orchestrator, system, githost       | **leaves** for the projects host           |

A system app is about the platform rather than about a project, so `/<slug>/` is not an address it
serves; leaving is the honest answer to a pick it cannot act on itself. The router's form carries
**no trailing slash**: `DefaultUrlSerializer` reads `/qits/` as `qits` plus an empty segment, which
matches no `:project` route and lands every pick on the application's `**`. A full-document href
keeps its slash — there the browser asks for the path and `Location` normalises it away before
anything is matched — so `scopePath` and `href` are unaffected. There is deliberately no
setter that only remembers: `select` navigates, so the URL stays the single statement of what is on
screen and the back button cannot disagree with the pill.

The scope also resolves what the API needs: `projectId()` maps the slug through the project list,
`repositoryId()` maps the repository name through the repository list. URLs name slugs, services
resolve ids, and this is where the two meet.

## Linking to another application

```ts
const appLinks = inject(QitsAppLinks); // providedIn: 'root'

appLinks.href('qits-ci', '', scope()); //            https://ci.dev.example.com/qits/services/qits-ci/
appLinks.href('qits-ci', 'runs/7', { project }); //  https://ci.dev.example.com/qits/runs/7
appLinks.href('qits-artifacts', 'images', scope()); // https://dev.example.com/artifacts/images
appLinks.origin('qits-artifacts'); //                undefined — no host of its own yet
appLinks.environmentOrigin(); //                     https://dev.example.com — clone URLs live here
```

`href` is the origin from the navigation, the scope path, then the path. An application the platform
does **not** serve on a host of its own is reached at its own segment — the `path` every entry
carries — under the environment origin, and the **scope is dropped** there: such an application has
no scoped address, and spelling one would produce a URL that 404s. Only an application the platform
names in no entry at all has no address here, and `href` says so with `undefined` rather than
inventing one; `legacyFallback` is a caller's segment for exactly that case, and an entry's own path
wins over it, being the platform's live statement rather than a guess frozen at release time.

`entries(slot)` reads one slot, and `isCurrent(entry, scope)` says whether an entry is the page on
screen — **host and path together**. The host alone would mark every entry of an application current
wherever the reader is inside it; the path alone would mark the ci entry current on the docs host,
because both spell the same repository path. An application with no host of its own is asked the
same question in its own terms: current where the reader is on the environment origin, under its
segment. `QITS_BROWSER_ORIGIN` is the seam a spec replaces to
say "we are on the ci host"; its factory reads the document, so a server render has an answer too.

## The layout

`QitsMainLayout` is the one component with a peer beyond `@angular/core` and `@angular/common`: it
renders a `<router-outlet />`, so `@angular/router` is a peer too. Mount it as the root _route_
component, never as a tag around your content —

```ts
export const routes: Routes = [{ path: '', component: QitsMainLayout, children: [/* the app */] }];
```

— and the chrome survives navigation while only the outlet changes. Its breakpoint is CSS, not a
media query in TypeScript: a persistent sidebar from 768px up, a burger in the top bar below it,
and the burger is the only state the component keeps.

The sidebar, top to bottom, is what the three reads make possible:

- **the project picker** in the top-left slot, its value the project slug;
- **Project**, when a project is in scope — the project's own page on qits-projects, with "Project
  setup" and the `project.detail` entries under it;
- **one group per category that has repositories** — SERVICES, DAEMONS, LIBS, FRONTENDS, CLI,
  IMAGES — one row per repository, ordered by name and blind to case, and under the repository
  **in scope** the `<category>.details` entries. Only the repository in scope opens: a tree that opened every repository would be as long
  as the project is big and would say nothing about where the reader is;
- **PLATFORM**, the `platform` entries, hidden while no project is in scope, because the group is
  about one;
- **SYSTEM**, the `system` entries, which are about the platform itself.

At most one row is marked current, and it is the most specific: the rows are built deepest-first and
the first current one wins. Two rows claiming the page would be two answers to "where am I", and the
sub-menu would have two places to go.

The links leave the SPA on purpose. Each destination is its own Angular application on its own host,
so they are plain `<a href>` full-document navigations — `routerLink` would look right and go
nowhere. That holds for the repository rows too: they address qits-projects, not this app.

Four states, and no compiled-in list behind any of them:

- **waiting** — no rows, and `aria-busy` on the `<nav>`;
- **answered** — the tree above, or the flat list for a legacy answer;
- **stranded** (empty answer, request failed, or no provider at all) — one link to `/` under a
  "Navigation unavailable" line. `/` is the platform's own root rather than a registry entry, so it
  is the one destination that cannot go stale;
- **repositories still coming** — "Loading repositories…" where the groups will be, and a spoken
  alert where that read failed.

A fallback list compiled in here would put back the drift this replaced _and hide it_: the chrome
would sometimes show what the platform serves and sometimes a guess frozen at release time, with
nothing on screen telling them apart. Nothing is guessed for an application without a host of its
own either — the platform states its segment as the entry's `path`, so it is drawn in its slot at
`<environment origin><path>/`. Under a repository such a row is drawn but never marked current: the
link goes to that application's front page, which says nothing about the repository on screen.

`[links]` is an explicit override in the flat shape. A **non-empty** list wins outright and the
source is not consulted, which is what lets a story or a spec render the real chrome with no
provider anywhere. Empty — the default — means "ask".

Both halves of the picker are required. With a list but no scope the slot keeps the wordmark: a
control that can neither say what is open nor act on a pick is worse in the most prominent place in
the chrome than the name it would have replaced. An app that provides neither is unchanged.

### The sub-menu

An application can hang its own menu under its own row: a documentation tree, a version picker.
Declare it **in the app shell, beside the `<router-outlet />`** —

```html
<ng-template qitsNavSubmenu><app-doc-tree /></ng-template> <router-outlet />
```

— and never inside a page. Getting that wrong is silent: a page's declaration is destroyed and
rebuilt on every navigation, so the panel would lose its scroll position and every open group on
each hop, in a menu that did not itself change. The layout renders it in a bare block and styles
nothing inside it, and the content keeps the shell's style scope, because view encapsulation
follows where a node is declared rather than where it is inserted. Where no row is this application
— the platform does not serve it yet, a bare `ng serve` — the sub-menu goes to the foot of the
navigation instead of nowhere.

## Install

`@qits/ui-components` lives in the platform's own npm repository, not on npmjs. A consumer needs
one `.npmrc` next to its `package.json` — the scope routing, nothing else:

    registry=http://localhost:8082/artifacts/npm/npmjs/     # everything, through the npmjs cache
    @qits:registry=http://localhost:8081/artifacts/npm/npm/ # ours

    pnpm add @qits/ui-components

Those are the addresses of a local platform as published on the deployment host, and they are two
services since the byte-plane split: the cache is `qits-platform-mirror` on 8082, the hosted scope
is `qits-artifacts` on 8081. Inside qits-net — a CI step, another container — the same two roots
are `http://qits-platform-mirror:8080/artifacts/npm/npmjs/` and
`http://qits-artifacts:8080/artifacts/npm/npm/`, and CI writes them from environment rather than
reading any file (see `.config/qits/ci-post-receive.yml`). Neither registry wants a credential.

The published package is the **prebuilt ng-packagr output** — FESM bundles and type definitions, in
Angular's partial compilation format. There is nothing to compile on install and no `prepare` hook;
consumers install a tarball like any other dependency.

### Pinning a `main` build takes an exact version, never a caret

A build off `main` is published as `<last released version>-main.g<sha7>` (see _Releasing_), and a
consumer reaching for one ahead of its release must spell it **exactly**:

    "@qits/ui-components": "2026.806.184725-main.gc03ad30"     # yes
    "@qits/ui-components": "^2026.806.184725-main.gc03ad30"    # no

The caret range admits `2026.806.184725` as well — a prerelease sorts _below_ the release it is
named after, so npm resolves the release and never mentions the prerelease again. What arrives is
the build the caller was trying to get ahead of, and the failure lands somewhere else entirely:
`error TS2305: Module '@qits/ui-components' has no exported member 'QitsPicker'`.

The trap is quiet because the caret usually works. It did for the first client to pin a `main`
build — but only because no stable release of that version existed yet for the range to prefer.
The moment one did, every caret pin silently moved backwards.

A pin like this is temporary by nature. Once the release lands, the range goes back to an ordinary
`^<version>`, and the maintenance-hop pipelines described in _Releasing_ write exactly that.

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
export class RunSummary {
  /* … */
}
```

## Development

    pnpm install
    pnpm lint            # eslint + angular-eslint, the qits- selector prefix enforced
    pnpm test            # vitest under jsdom
    pnpm build           # ng-packagr → dist/qits-spa-ui-components, then check-exports
    pnpm storybook       # the component workbench on :6006
    pnpm build-storybook # the same, static, into storybook-static/

`pnpm build` runs `scripts/check-exports.mjs` over the output: it is the manifest ng-packagr
_writes_ that gets published, so the check reads that one — the package name, the version against
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

Storybook is the place to _look_ at a component, which is the one thing a jsdom spec cannot do.
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

The version in `projects/qits-spa-ui-components/package.json` is stamped by the release door — the
CalVer that names the release commit and the tag — and never edited by hand. The release pipeline
below stops when the built manifest and the tag disagree, so a hand-picked number is a red release
rather than a version. A breaking change is therefore not a different kind of number: it is the next
CalVer, and what consumers need is the note in _Pinning_ above.

Two pipelines publish, and they publish different things.

`.config/qits/ci-post-receive.yml` runs on every push to `main`. It installs, lints, tests, builds
and publishes `<last released version>-main.g<sha7>` under the **`main`** dist-tag — a build of the
branch, named so nobody mistakes it for a release. The explicit `--tag main` is load-bearing: a bare
`npm publish` would move `latest` to a prerelease.

`.config/qits/ci-event-release.yml` is the release pipeline. It reacts to this repository's own
release **tag** (`SCMPublishTag`), checks that tag out, builds it and publishes the real version
under `latest`. Both publish **if absent** — published versions are immutable and an event can be
redelivered, so a second run of one release goes green rather than fighting the registry.

The tag is the trigger because it is the durable stamp: a bootstrap replay restores this release by
pushing the tag alone, and the pipeline re-derives the tarball from it.

The release train runs through this library. A real release also publishes `SCMRelease`, which says
only that source control has the version; `SoftwareRelease` is what qits-ci publishes where a green
release run and an `SCMRelease` meet, and it means the tarball is in the registry. Consumers trigger
on the last one, so a bump pipeline can install what it was told about — and a replay, which has no
`SCMRelease`, republishes silently and wakes no train (scm-release-split-plan.md,
bootstrap-replay-plan.md).

The layout no longer carries a list of the platform's doors. It asks the gateway, which derives the
answer from the routes it actually serves — so a component appearing, moving or being retired is one
deployment of one process, not a release here and a bump in nine SPAs.
