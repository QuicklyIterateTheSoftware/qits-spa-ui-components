import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** One entry in the platform navigation: what it is called, and where it lives. */
export interface QitsNavLink {
  readonly label: string;
  readonly href: string;
}

/**
 * Every SPA of the platform, in the order they are shown. These are *separate* Angular
 * applications served at different base paths, so the hrefs are absolute paths rather than routes:
 * moving between them is a full-document navigation, which no router can perform.
 *
 * Exported so an app can reuse the list, reorder it, or splice its own entries in and hand the
 * result back to `<qits-main-layout [links]="…">`.
 */
export const QITS_NAV_LINKS: readonly QitsNavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'CI', href: '/ci/' },
  { label: 'Artifacts', href: '/artifacts/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'Workspaces', href: '/workspaces/' },
  { label: 'Events', href: '/events/' },
  { label: 'Observability', href: '/observability/' },
];

/** `/ci` and `/ci/` name the same application; comparing normalised paths keeps the match honest. */
function toDirectoryPath(href: string): string {
  const { pathname } = new URL(href || '/', 'http://qits.invalid');
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * The application skeleton every qits SPA mounts as its root *route* component —
 * `{ path: '', component: QitsMainLayout, children: [...] }` — so the chrome survives navigation
 * and only the `<router-outlet />` beneath it changes.
 *
 * The breakpoint is CSS, not JavaScript: from 768px up the navigation is a persistent sidebar, and
 * below it a burger in the top bar reveals it. Only the burger is state, which is why resizing a
 * window never has to be observed and the component renders the same on a server as in a browser.
 *
 * The links leave the SPA on purpose. Each destination is its own Angular application behind its
 * own base path, so they are plain `<a href>` full-document navigations — `routerLink` would look
 * right and go nowhere.
 */
@Component({
  selector: 'qits-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <div class="qits-layout">
      <header class="qits-layout-bar">
        <button
          type="button"
          class="qits-layout-burger"
          aria-label="Toggle navigation"
          aria-controls="qits-layout-nav"
          [attr.aria-expanded]="navOpen()"
          (click)="toggleNav()"
        >
          <span class="qits-layout-burger-glyph" aria-hidden="true">☰</span>
        </button>
        <span class="qits-layout-brand">{{ brand() }}</span>
      </header>

      <nav
        id="qits-layout-nav"
        class="qits-layout-nav"
        [class.qits-layout-nav-open]="navOpen()"
        [attr.aria-label]="brand() + ' navigation'"
      >
        <ul class="qits-layout-links">
          @for (link of navLinks(); track link.href) {
            <li>
              <a
                class="qits-layout-link"
                [class.qits-layout-link-current]="link.current"
                [href]="link.href"
                [attr.aria-current]="link.current ? 'page' : null"
                (click)="closeNav()"
                >{{ link.label }}</a
              >
            </li>
          }
        </ul>
      </nav>

      <main class="qits-layout-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100vh;
      height: 100dvh;
      color: #111827;
    }
    .qits-layout {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: auto auto 1fr;
      height: 100%;
      min-height: 0;
    }
    .qits-layout-bar {
      grid-column: 1;
      grid-row: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .qits-layout-brand {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .qits-layout-burger {
      font: inherit;
      font-size: 18px;
      line-height: 1;
      padding: 2px 8px;
      background: transparent;
      color: inherit;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
    }
    .qits-layout-burger:hover {
      background: #f3f4f6;
    }
    .qits-layout-nav {
      grid-column: 1;
      grid-row: 2;
      display: none;
      overflow-y: auto;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .qits-layout-nav-open {
      display: block;
    }
    .qits-layout-links {
      list-style: none;
      margin: 0;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .qits-layout-link {
      display: block;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 14px;
      color: #374151;
      text-decoration: none;
    }
    .qits-layout-link:hover {
      background: #f3f4f6;
      color: #111827;
    }
    .qits-layout-link-current {
      background: #e5e7eb;
      color: #111827;
      font-weight: 600;
    }
    .qits-layout-content {
      grid-column: 1;
      grid-row: 3;
      min-height: 0;
      overflow-y: auto;
      padding: 16px;
    }

    /* From here up the navigation is always there, as a column beside the content. */
    @media (min-width: 768px) {
      .qits-layout {
        grid-template-columns: 240px 1fr;
        grid-template-rows: auto 1fr;
      }
      .qits-layout-bar {
        border-right: 1px solid #e5e7eb;
      }
      .qits-layout-burger {
        display: none;
      }
      .qits-layout-nav {
        grid-row: 2;
        display: block;
        border-bottom: none;
        border-right: 1px solid #e5e7eb;
      }
      .qits-layout-content {
        grid-column: 2;
        grid-row: 1 / span 2;
      }
    }
  `,
})
export class QitsMainLayout {
  /** What the bar calls this platform. */
  readonly brand = input<string>('qits');
  /** The destinations shown in the navigation; every qits SPA by default. */
  readonly links = input<readonly QitsNavLink[]>(QITS_NAV_LINKS);

  private readonly doc = inject(DOCUMENT);

  /**
   * Which link is *this* application. Read once from the document's base URI rather than from the
   * router, because the thing being matched is the app's own mount point, not its current route —
   * and because a base URI exists on a server too.
   */
  private readonly basePath = toDirectoryPath(this.doc.baseURI ?? '/');

  protected readonly navOpen = signal(false);

  protected readonly navLinks = computed(() =>
    this.links().map((link) => ({
      ...link,
      current: toDirectoryPath(link.href) === this.basePath,
    })),
  );

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  /** A link is a full-document navigation, but the panel must not be left open behind it. */
  protected closeNav(): void {
    this.navOpen.set(false);
  }
}
