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

/** One entry in the platform navigation: what it is called, and where it lives. */
export interface QitsNavLink {
  readonly label: string;
  readonly href: string;
}

/**
 * The body the platform answers with. An object rather than a bare array so the answer can grow a
 * field — a revision marker, a grouping — without every SPA needing a release before the platform
 * can send it. A bare array has nowhere to put anything new.
 */
export interface QitsNavigation {
  readonly links: readonly QitsNavLink[];
}

/**
 * Where `QitsMainLayout` gets its links. Two signals rather than one value, because one page load
 * passes through three states — nothing yet, an answer, or given up — and the layout renders each
 * of them differently. `links()` is `undefined` while nothing has answered; `failed()` says nothing
 * ever will.
 */
export interface QitsNavigationSource {
  readonly links: Signal<readonly QitsNavLink[] | undefined>;
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
 * Which components the platform routes is the *gateway's* knowledge. The gateway is also the only
 * process on the platform with no path segment of its own — it is what mounts everything else
 * behind one — so its own root is the only address every SPA can spell the same way. A SPA asking
 * its own backend instead would be asking a service that knows what it does and nothing whatever
 * about what is deployed beside it.
 */
export const QITS_NAVIGATION_URL = '/main-navigation';

/**
 * The navigation as the gateway sees it: one request, at startup, for the life of the application.
 *
 * Deliberately no rxjs import. `HttpClient.get()` hands back something with a `.subscribe()`, and
 * `Observable` appears here only as an inferred type — types are erased, so nothing of rxjs
 * survives into the bundle and this library keeps its three peer dependencies. `toSignal` and
 * `httpResource` both read better and both cost that: the first drags in
 * `@angular/core/rxjs-interop`, and the second is still `@experimental` in Angular 21.2, which a
 * published package on a `^21.2.0` peer range must not put in front of its consumers.
 */
class HttpNavigationSource implements QitsNavigationSource {
  private readonly answered = signal<readonly QitsNavLink[] | undefined>(undefined);
  private readonly gaveUp = signal(false);

  readonly links: Signal<readonly QitsNavLink[] | undefined> = this.answered.asReadonly();
  readonly failed: Signal<boolean> = this.gaveUp.asReadonly();

  constructor(url: string) {
    // Constructed from a `useFactory`, which runs inside an injection context — that is what makes
    // these `inject()` calls legal from a plain class the injector never sees.
    const subscription = inject(HttpClient)
      .get<QitsNavigation>(url)
      .subscribe({
        next: (navigation) => this.answered.set(navigation?.links ?? []),
        // A navigation that could not be fetched is not a failed application: the app still runs,
        // it just cannot say where else the reader could go. The layout renders that state.
        error: () => {
          this.answered.set([]);
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
 * nothing else. Pass `url` only to point at something other than the gateway's `/main-navigation` —
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
 * The same contract answered from a literal: for specs, for stories, and for any app served
 * without a gateway in front of it.
 *
 * Nothing is fetched, and that is the point rather than a detail. There is no request for
 * `HttpTestingController.verify()` to complain about, nothing to flush before an assertion, and no
 * pending task to keep `fixture.whenStable()` from resolving — so a spec about anything *else* in
 * the layout does not have to know the navigation exists.
 */
export function provideQitsNavigationLinks(links: readonly QitsNavLink[]): EnvironmentProviders {
  const source: QitsNavigationSource = {
    links: signal<readonly QitsNavLink[] | undefined>(links),
    failed: signal(false),
  };
  return makeEnvironmentProviders([{ provide: QITS_NAVIGATION, useValue: source }]);
}
