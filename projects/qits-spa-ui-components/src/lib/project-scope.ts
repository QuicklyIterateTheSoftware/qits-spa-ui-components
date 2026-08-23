import { DestroyRef, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * Which project the chrome is showing, and what picking one does.
 *
 * The picker in the top-left slot renders the *platform's* projects, but which of them is current
 * is an application's own knowledge: qits-spa-projects reads it out of the path, and an application
 * whose addresses do not name a project yet carries it in a query parameter. Both are answers to
 * the same two questions, so both are this interface — the chrome asks, it does not decide.
 *
 * <p><b>There is deliberately no setter that only remembers.</b> `select` is expected to *navigate*,
 * so the URL stays the single statement of what is on screen. A scope that stored the pick beside
 * the URL would be a second source of truth, and the two would disagree the first time someone
 * pressed the back button.
 */
export interface QitsProjectScope {
  /** The project on screen, or `undefined` for none. */
  readonly projectId: Signal<string | undefined>;
  /** Go to a project — or, for `undefined`, out of the one currently scoped. */
  select(projectId: string | undefined): void;
}

/**
 * How the chrome asks which project is current. Optional: with no scope provided the picker is not
 * rendered at all, because a control that cannot say what is selected and cannot act on a pick is
 * worse than the brand text it replaced.
 */
export const QITS_PROJECT_SCOPE = new InjectionToken<QitsProjectScope>('QITS_PROJECT_SCOPE');

/** The query parameter the default scope reads and writes. */
export const QITS_PROJECT_QUERY_PARAM = 'project';

/** `?project=` out of a URL, or `undefined` — including for the array form of a repeated parameter. */
function readProjectId(router: Router, url: string): string | undefined {
  const value = router.parseUrl(url).queryParams[QITS_PROJECT_QUERY_PARAM] as unknown;
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * The default scope, installed by `provideQitsProjects()`: the picked project rides in `?project=`
 * on whatever page the reader is already on.
 *
 * <p>A query parameter and <b>not</b> storage, deliberately. A remembered pick would make the same
 * URL render differently for two people and would silently re-scope a page opened from a bookmark;
 * `?project=` keeps every address a complete statement of what it shows, and keeps it shareable.
 * The cost is that a bare `/ci/` starts unscoped, which is the honest state rather than a guess.
 *
 * <p>This is the scope for applications that <b>do not yet</b> read the parameter. They render the
 * picker, the pick lands in the URL, and their pages ignore it until each one is scoped — that is
 * the intended intermediate state, not an oversight.
 *
 * <p>No rxjs operators: the events are a plain subscription with an `instanceof` test, which keeps
 * this package on its three peer dependencies. The signal is *seeded* from `router.url` as well as
 * fed by the stream, because a reader landing directly on a scoped URL gets no `NavigationEnd`
 * before the first render.
 */
@Injectable()
export class QueryParamProjectScope implements QitsProjectScope {
  private readonly router = inject(Router);
  private readonly current = signal(readProjectId(this.router, this.router.url));

  readonly projectId: Signal<string | undefined> = this.current.asReadonly();

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.current.set(readProjectId(this.router, this.router.url));
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /**
   * Rewrite the parameter on the current address and go there — the path is kept, so picking a
   * project does not also move the reader off the page they were reading.
   */
  select(projectId: string | undefined): void {
    const tree = this.router.parseUrl(this.router.url);
    // Rebuilt rather than mutated in place, so clearing removes the key instead of leaving it
    // present and undefined — which serialises as a bare `?project=` rather than as nothing.
    const rest = { ...tree.queryParams };
    delete rest[QITS_PROJECT_QUERY_PARAM];
    tree.queryParams =
      projectId === undefined ? rest : { ...rest, [QITS_PROJECT_QUERY_PARAM]: projectId };
    void this.router.navigateByUrl(tree);
  }
}
