import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';

/**
 * Where an application hangs in the chrome. A closed set, because a slot is a *place in the
 * sidebar* rather than a name the edge invents: `<category>.details` sits under the repository in
 * scope, `project.detail` under the Project node, `platform` is a project-scoped group and
 * `system` is the global one. An entry naming anything else is dropped rather than guessed at.
 */
export type QitsNavSlot =
  | 'services.details'
  | 'daemons.details'
  | 'libs.details'
  | 'frontends.details'
  | 'cli.details'
  | 'images.details'
  | 'project.detail'
  | 'platform'
  | 'system';

/** Every slot, in no particular order — the sidebar decides where each one is drawn. */
export const QITS_NAV_SLOTS: readonly QitsNavSlot[] = [
  'services.details',
  'daemons.details',
  'libs.details',
  'frontends.details',
  'cli.details',
  'images.details',
  'project.detail',
  'platform',
  'system',
];

/** One entry of the flat navigation the platform served before slots existed. */
export interface QitsNavLink {
  readonly label: string;
  readonly href: string;
}

/**
 * One application in one slot: what it is called, which host serves it, and where that host is.
 *
 * `host` is `null` for an application the edge does not serve on a host of its own yet. Such an
 * entry carries the *environment* origin and is reached at `path` under it — which is why both
 * fields are served rather than derived: only the edge knows which of the two an origin is, and
 * only it knows the segment the application answers on.
 *
 * `path` is the application's own route prefix (`/ci`), normalised to a leading slash and no
 * trailing one. A hosted application has it too; it is simply not needed to address one.
 */
export interface QitsNavEntry {
  readonly app: string;
  readonly label: string;
  readonly host: string | null;
  readonly origin: string;
  readonly path: string;
  readonly position: number;
  readonly slot: QitsNavSlot;
}

/** One entry as the platform serves it: {@link QitsNavEntry} without the slot it is filed under. */
export interface QitsNavEntryBody {
  readonly app: string;
  readonly label: string;
  readonly host?: string | null;
  readonly origin: string;
  readonly path?: string;
  readonly position?: number;
}

/**
 * The body the platform answers with. Every field optional, deliberately: an edge that predates
 * slots answers `{links}` alone, and a released SPA has to keep working in front of it for the one
 * release the flat shape survives.
 */
export interface QitsNavigation {
  readonly environment?: string;
  /** The environment's own origin — where an application without a host of its own is served. */
  readonly origin?: string;
  readonly slots?: Readonly<Partial<Record<QitsNavSlot, readonly QitsNavEntryBody[]>>>;
  /** The flat shape, from an edge that does not know about slots. */
  readonly links?: readonly QitsNavLink[];
}

/**
 * The navigation the chrome renders, normalised: one flat list of entries carrying their slot, and
 * the legacy list *only* when the answer had no slots at all.
 *
 * The two are exclusive on purpose. `legacy` set means "this platform cannot tell me its shape",
 * and the sidebar then draws the flat list it always drew rather than an empty tree beside a
 * handful of links.
 */
export interface QitsNavTree {
  /** Every slot flattened, sorted by position and then label. */
  readonly entries: readonly QitsNavEntry[];
  /** Where the environment itself is served, if the platform said. */
  readonly environmentOrigin: string | undefined;
  /** The flat links of a pre-slots answer, and `undefined` whenever slots were served. */
  readonly legacy: readonly QitsNavLink[] | undefined;
}

/**
 * Where `QitsMainLayout` gets its navigation. Two signals rather than one value, because one page
 * load passes through three states — nothing yet, an answer, or given up — and the layout renders
 * each of them differently. `tree()` is `undefined` while nothing has answered; `failed()` says
 * nothing ever will.
 */
export interface QitsNavigationSource {
  readonly tree: Signal<QitsNavTree | undefined>;
  readonly failed: Signal<boolean>;
}

/**
 * The navigation the layout renders, as an interface behind a token rather than a class with
 * options. The two implementations shipped here are not variations on one thing: one makes a
 * request and lives through a pending state, the other is a literal that is answered from the
 * moment it exists. A single class would have to pretend one of those is the other.
 */
export const QITS_NAVIGATION = new InjectionToken<QitsNavigationSource>('QITS_NAVIGATION');

/**
 * Where the navigation is asked for — **absolute**, deliberately not relative to the SPA's base
 * href, and so the one place this library breaks with the platform's `api/config.json` convention
 * of a SPA reading from the service behind it.
 *
 * Which applications the platform routes is the *edge's* knowledge, and the edge answers this on
 * every host it serves. A SPA asking its own backend instead would be asking a service that knows
 * what it does and nothing whatever about what is deployed beside it.
 */
export const QITS_NAVIGATION_URL = '/main-navigation';

/** The stranded answer: nothing to show, and no legacy list to fall back on either. */
const NOTHING: QitsNavTree = { entries: [], environmentOrigin: undefined, legacy: [] };

/** `/ci`, from `ci`, `/ci` or `/ci/` — a prefix to join to, with nothing to guess at either end. */
function toPathPrefix(path: string | undefined): string {
  if (!path) return '';
  const leading = path.startsWith('/') ? path : `/${path}`;
  return leading.replace(/\/+$/, '');
}

/** Entries first by position, then by label — so two entries at one position still have an order. */
function inOrder(a: QitsNavEntry, b: QitsNavEntry): number {
  return a.position - b.position || a.label.localeCompare(b.label);
}

/**
 * The answer as the chrome needs it. Unknown slot keys are ignored rather than rendered somewhere
 * arbitrary, and an entry missing a label or an origin is dropped: a nameless link is not a thing
 * a reader can act on.
 */
export function toNavTree(body: QitsNavigation | null | undefined): QitsNavTree {
  const slots = body?.slots;
  if (!slots) {
    return { entries: [], environmentOrigin: body?.origin, legacy: body?.links ?? [] };
  }
  const entries: QitsNavEntry[] = [];
  for (const slot of QITS_NAV_SLOTS) {
    for (const entry of slots[slot] ?? []) {
      if (!entry?.app || !entry.label || !entry.origin) continue;
      entries.push({
        app: entry.app,
        label: entry.label,
        host: entry.host ?? null,
        origin: entry.origin,
        path: toPathPrefix(entry.path),
        position: entry.position ?? 0,
        slot,
      });
    }
  }
  return { entries: entries.sort(inOrder), environmentOrigin: body?.origin, legacy: undefined };
}

/**
 * The navigation as the edge sees it: one request, at startup, for the life of the application.
 *
 * Deliberately no rxjs import. `HttpClient.get()` hands back something with a `.subscribe()`, and
 * `Observable` appears here only as an inferred type — types are erased, so nothing of rxjs
 * survives into the bundle and this library keeps its three peer dependencies. `toSignal` and
 * `httpResource` both read better and both cost that: the first drags in
 * `@angular/core/rxjs-interop`, and the second is still `@experimental` in Angular 21.2, which a
 * published package on a `^21.2.0` peer range must not put in front of its consumers.
 */
class HttpNavigationSource implements QitsNavigationSource {
  private readonly answered = signal<QitsNavTree | undefined>(undefined);
  private readonly gaveUp = signal(false);

  readonly tree: Signal<QitsNavTree | undefined> = this.answered.asReadonly();
  readonly failed: Signal<boolean> = this.gaveUp.asReadonly();

  constructor(url: string) {
    // Constructed from a `useFactory`, which runs inside an injection context — that is what makes
    // these `inject()` calls legal from a plain class the injector never sees.
    const subscription = inject(HttpClient)
      .get<QitsNavigation>(url)
      .subscribe({
        next: (navigation) => this.answered.set(toNavTree(navigation)),
        // A navigation that could not be fetched is not a failed application: the app still runs,
        // it just cannot say where else the reader could go. The layout renders that state.
        error: () => {
          this.answered.set(NOTHING);
          this.gaveUp.set(true);
        },
      });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }
}

/**
 * Ask the platform what it contains, and give the answer to `QitsMainLayout`.
 *
 * **Requires `provideHttpClient()`** in the same application config; this issues one `GET` and owns
 * nothing else. Pass `url` only to point at something other than the edge's `/main-navigation` —
 * a fixture, a second platform behind a proxy.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideHttpClient(), provideRouter(routes), provideQitsNavigation()],
 * });
 * ```
 */
export function provideQitsNavigation(options?: { readonly url?: string }): EnvironmentProviders {
  const url = options?.url ?? QITS_NAVIGATION_URL;
  return makeEnvironmentProviders([
    { provide: QITS_NAVIGATION, useFactory: () => new HttpNavigationSource(url) },
  ]);
}

/**
 * The same contract answered from a literal — a whole payload, slots and all: for specs, for
 * stories, and for any app served without the platform in front of it.
 *
 * Nothing is fetched, and that is the point rather than a detail. There is no request for
 * `HttpTestingController.verify()` to complain about, nothing to flush before an assertion, and no
 * pending task to keep `fixture.whenStable()` from resolving.
 */
export function provideQitsNavigationTree(navigation: QitsNavigation): EnvironmentProviders {
  const source: QitsNavigationSource = {
    tree: signal<QitsNavTree | undefined>(toNavTree(navigation)),
    failed: signal(false),
  };
  return makeEnvironmentProviders([{ provide: QITS_NAVIGATION, useValue: source }]);
}

/**
 * The legacy flat shape from a literal — what an edge that does not know about slots answers, and
 * what the sidebar still draws when it gets it.
 */
export function provideQitsNavigationLinks(links: readonly QitsNavLink[]): EnvironmentProviders {
  return provideQitsNavigationTree({ links });
}
