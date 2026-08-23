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

import { QITS_PROJECT_SCOPE, QueryParamProjectScope } from './project-scope';

/** One project, as the chrome needs it: an id to address it by, and a name to show. */
export interface QitsProject {
  readonly id: string;
  readonly name: string;
}

/**
 * The body qits-projects answers a listing with. Two levels deep because the service wraps every
 * row in an entry envelope — room for what a row is *about* the project rather than of it — and the
 * shape is copied here rather than shared: this library depends on no qits module, and the two
 * fields it reads are the two that cannot change without breaking every SPA at once.
 */
export interface QitsProjectEntries {
  readonly entries: readonly { readonly project: QitsProject }[];
}

/**
 * Where `QitsMainLayout` gets the projects its picker offers. The same three states
 * `QitsNavigationSource` has, for the same reason: one page load passes through nothing-yet, an
 * answer, and given-up, and the chrome draws each of them differently.
 */
export interface QitsProjectsSource {
  readonly projects: Signal<readonly QitsProject[] | undefined>;
  readonly failed: Signal<boolean>;
}

/**
 * The projects the chrome offers, behind a token so the two shipped implementations — one that
 * fetches and lives through a pending state, one answered from a literal — do not have to pretend
 * to be one class.
 *
 * **Optional by construction.** An application that provides nothing gets the brand text in the top
 * left, exactly as before this existed. Providing it is what puts the picker there.
 */
export const QITS_PROJECTS = new InjectionToken<QitsProjectsSource>('QITS_PROJECTS');

/**
 * Where the projects are asked for — **absolute**, and the second address in this library that is
 * not relative to the SPA's own base href (the first is `/main-navigation`).
 *
 * Every SPA on this platform is served same-origin behind the edge, so an absolute path is not a
 * shortcut: it is what carries the browser's session cookie to qits-projects with no machine token
 * and no CORS pre-flight. A SPA asking *its own* backend for projects would be asking a service
 * that does not own them.
 */
export const QITS_PROJECTS_URL = '/projects/api/projects';

/**
 * The project list as qits-projects sees it: one request, at startup, for the life of the app.
 *
 * Deliberately no rxjs import, for the reason `HttpNavigationSource` gives — `Observable` appears
 * only as an inferred type, types are erased, and this package keeps its three peer dependencies.
 */
class HttpProjectsSource implements QitsProjectsSource {
  private readonly answered = signal<readonly QitsProject[] | undefined>(undefined);
  private readonly gaveUp = signal(false);

  readonly projects: Signal<readonly QitsProject[] | undefined> = this.answered.asReadonly();
  readonly failed: Signal<boolean> = this.gaveUp.asReadonly();

  constructor(url: string) {
    // Constructed from a `useFactory`, which runs inside an injection context — that is what makes
    // these `inject()` calls legal from a plain class the injector never sees.
    const subscription = inject(HttpClient)
      .get<QitsProjectEntries>(url)
      .subscribe({
        next: (body) => this.answered.set((body?.entries ?? []).map((entry) => entry.project)),
        // A list that could not be fetched is not a failed application: every page still renders,
        // the chrome just cannot say which projects there are. The layout draws that state.
        error: () => {
          this.answered.set([]);
          this.gaveUp.set(true);
        },
      });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }
}

/**
 * Put the project picker in the chrome's top-left slot, filled from qits-projects.
 *
 * **Requires `provideHttpClient()`** in the same application config; this issues one `GET` and owns
 * nothing else. Pass `url` only to point at something other than `/projects/api/projects` — a
 * fixture, a dev proxy prefix.
 *
 * It also installs the **default project scope** — the picked project carried in `?project=` on the
 * current URL, see {@link QueryParamProjectScope}. An application whose own addresses already say
 * which project is on screen overrides that by providing `QITS_PROJECT_SCOPE` *after* this call;
 * qits-spa-projects does exactly that, because there the project id is the first path segment.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideHttpClient(), provideRouter(routes), provideQitsNavigation(), provideQitsProjects()],
 * });
 * ```
 */
export function provideQitsProjects(options?: { readonly url?: string }): EnvironmentProviders {
  const url = options?.url ?? QITS_PROJECTS_URL;
  return makeEnvironmentProviders([
    { provide: QITS_PROJECTS, useFactory: () => new HttpProjectsSource(url) },
    { provide: QITS_PROJECT_SCOPE, useClass: QueryParamProjectScope },
  ]);
}

/**
 * The same contract answered from a literal: for specs, for stories, and for any app served without
 * the platform in front of it.
 *
 * Nothing is fetched, and that is the point rather than a detail — there is no request for
 * `HttpTestingController.verify()` to complain about and no pending task to keep
 * `fixture.whenStable()` from resolving, so a spec about anything *else* in the chrome does not
 * have to know the picker makes a request.
 */
export function provideQitsProjectList(
  projects: readonly QitsProject[],
  options?: { readonly failed?: boolean },
): EnvironmentProviders {
  const source: QitsProjectsSource = {
    projects: signal<readonly QitsProject[] | undefined>(projects),
    failed: signal(options?.failed ?? false),
  };
  return makeEnvironmentProviders([
    { provide: QITS_PROJECTS, useValue: source },
    { provide: QITS_PROJECT_SCOPE, useClass: QueryParamProjectScope },
  ]);
}
