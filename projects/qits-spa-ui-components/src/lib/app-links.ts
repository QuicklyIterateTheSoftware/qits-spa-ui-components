import { DOCUMENT, inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';

import { QITS_NAVIGATION, type QitsNavEntry, type QitsNavSlot } from './navigation';
import { scopePath, type QitsScope } from './scope';

/**
 * The origin the browser has this SPA open at — the seam a spec replaces to say "we are on the ci
 * host". The factory reads the document rather than `window`, so a server render has an answer too.
 */
export const QITS_BROWSER_ORIGIN = new InjectionToken<string>('QITS_BROWSER_ORIGIN', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).location?.origin ?? '',
});

/** The host part of an origin, port included — or `undefined` for something that is not one. */
function hostOf(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

/** `a` + `b` with exactly one slash between them, whatever each side brought. */
function join(prefix: string, path: string): string {
  return `${prefix.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Addresses of the *other* applications on this platform.
 *
 * <p>Every service is its own host — `ci.dev.example.com` — and every SPA shares one URL grammar
 * beneath it, so a cross-application link is an origin from the navigation plus the scope path of
 * whatever is on screen. Nothing here is compiled in: an application the platform does not serve
 * has no origin, and this says so with `undefined` rather than inventing one.
 *
 * <p>Full-document links on purpose. The destination is a different Angular application, so
 * `routerLink` would compile and go nowhere.
 */
@Injectable({ providedIn: 'root' })
export class QitsAppLinks {
  private readonly source = inject(QITS_NAVIGATION, { optional: true });
  private readonly browserOrigin = inject(QITS_BROWSER_ORIGIN);
  private readonly doc = inject(DOCUMENT);
  /**
   * Optional: an application always has one, a bare spec of this service need not. The router is
   * asked before the document because it is the address the reader actually navigated to.
   */
  private readonly router = inject(Router, { optional: true });

  /** The first entry for an application — one application may appear in several slots. */
  private entry(app: string): QitsNavEntry | undefined {
    return this.source?.tree()?.entries.find((entry) => entry.app === app);
  }

  /** Where an application is served, or `undefined` while it has no host of its own. */
  origin(app: string): string | undefined {
    const entry = this.entry(app);
    return entry?.host ? entry.origin : undefined;
  }

  /** Where the environment itself is served — the origin of a clone URL, and of a legacy link. */
  environmentOrigin(): string | undefined {
    return this.source?.tree()?.environmentOrigin;
  }

  /** The entries of one slot, in the order they are meant to be drawn. */
  entries(slot: QitsNavSlot): readonly QitsNavEntry[] {
    return this.source?.tree()?.entries.filter((entry) => entry.slot === slot) ?? [];
  }

  /**
   * A link into another application: its origin, the scope path, then `path`.
   *
   * `legacyFallback` is the application's old path segment — `/ci/` — and it is used only where the
   * application has **no host of its own** yet. Such an app is still served under the environment
   * origin at that segment, and it has no scoped address, so the scope is deliberately dropped
   * rather than spelled into a URL that would 404. With no fallback given, an application the
   * platform does not serve on a host has no address here, and the caller gets `undefined`.
   */
  href(app: string, path: string, scope?: QitsScope, legacyFallback?: string): string | undefined {
    const own = this.origin(app);
    if (own) return join(own, join(scopePath(scope), path));
    const environment = this.environmentOrigin();
    if (!environment || !legacyFallback) return undefined;
    return join(environment, join(legacyFallback, path));
  }

  /** The path the reader is on: the router's URL where there is one, else the document's. */
  currentPath(): string {
    const url = this.router?.url ?? this.doc.location?.pathname ?? '/';
    return url.split(/[?#]/, 1)[0] || '/';
  }

  /**
   * Whether an entry is the page on screen: same host, and a path inside that scope.
   *
   * Both halves are needed. The host alone would mark every entry of an application current
   * wherever the reader is inside it; the path alone would mark the ci entry current on the docs
   * host, because both spell the same repository path.
   *
   * An entry without a host of its own is never current: it is served under the environment origin
   * at a path this library was not told, so there is nothing honest to compare.
   */
  isCurrent(entry: QitsNavEntry, scope?: QitsScope): boolean {
    if (!entry.host) return false;
    const host = hostOf(entry.origin);
    if (!host || host !== hostOf(this.browserOrigin)) return false;
    return this.currentPath().startsWith(scopePath(scope));
  }
}
