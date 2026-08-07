import { NgTemplateOutlet } from '@angular/common';
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

import { QitsNavSubmenuSlot } from './nav-submenu';
import { QITS_NAVIGATION, type QitsNavLink } from './navigation';

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
 * right and go nowhere. Where the list *comes from* is `QITS_NAVIGATION`: the platform is asked
 * what it contains rather than told at compile time, because a list compiled into this package is
 * a second source of truth for the platform's own topology and it will lag the first one.
 *
 * Under the entry that is this application, an app can hang a sub-menu of its own —
 * `<ng-template qitsNavSubmenu>` in the shell, see {@link QitsNavSubmenu}. The layout gives it a
 * bare block and styles nothing inside it.
 */
@Component({
  selector: 'qits-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NgTemplateOutlet],
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
        [attr.aria-busy]="pending() ? 'true' : null"
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
              @if (link.current) {
                <!-- Two nested @if rather than one condition: \`link.current && submenu()\` narrows to
                     \`TemplateRef | false | null\`, which ngTemplateOutlet rejects under strictTemplates. -->
                @if (submenu(); as tpl) {
                  <!-- The click handler only closes the mobile panel behind a link the browser was
                       going to follow anyway. Giving this box focus would put a tab stop in front of
                       the sub-menu's own controls, which a keyboard reaches directly. -->
                  <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus, @angular-eslint/template/click-events-have-key-events -->
                  <div class="qits-layout-submenu" (click)="onSubmenuNavigate($event)">
                    <ng-container [ngTemplateOutlet]="tpl" />
                  </div>
                }
              }
            </li>
          }
        </ul>

        @if (stranded()) {
          <p class="qits-layout-stranded">Navigation unavailable</p>
          <a class="qits-layout-escape" href="/" (click)="closeNav()">Home</a>
        }

        @if (!hasCurrent()) {
          @if (submenu(); as tpl) {
            <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus, @angular-eslint/template/click-events-have-key-events -->
            <div
              class="qits-layout-submenu qits-layout-submenu-detached"
              (click)="onSubmenuNavigate($event)"
            >
              <ng-container [ngTemplateOutlet]="tpl" />
            </div>
          }
        }
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
      /* A grid item is min-height: auto, so it refuses to shrink below its content. Without this a
         tall sub-menu grows the grid row instead of scrolling here, and the sidebar — with the
         burger and the content beneath it — runs off the bottom of the viewport. */
      min-height: 0;
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

    /* A box, not a look. What goes in here is the application's, declared in the application's own
       style scope, so the layout gives it room and nothing else. */
    .qits-layout-submenu {
      display: block;
      min-width: 0;
    }

    .qits-layout-stranded {
      margin: 0;
      padding: 8px 18px 2px;
      font-size: 13px;
      color: #6b7280;
    }
    .qits-layout-escape {
      display: block;
      margin: 0 8px 8px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 14px;
      color: #374151;
      text-decoration: none;
    }
    .qits-layout-escape:hover {
      background: #f3f4f6;
      color: #111827;
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
        /* Restated with the row: as a full-height column the sidebar is the item a tall sub-menu
           would stretch, and min-height: auto would let it push the grid past the viewport. */
        min-height: 0;
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
  /**
   * An explicit override of the platform navigation. Left empty — the default — the layout asks
   * `QITS_NAVIGATION` instead. A **non-empty** list wins outright and the source is not consulted
   * at all, which is what lets a story, a spec or a `ng serve` with no gateway in front of it
   * render the real chrome with no provider anywhere.
   */
  readonly links = input<readonly QitsNavLink[]>([]);

  private readonly doc = inject(DOCUMENT);
  /**
   * Optional on purpose. An app that forgets the provider lands in the stranded state below — one
   * way out, and a line saying so — rather than failing to bootstrap at all with NG0201.
   */
  private readonly source = inject(QITS_NAVIGATION, { optional: true });

  /** What an application hung under its own entry, if anything. */
  protected readonly submenu = inject(QitsNavSubmenuSlot).template;

  /**
   * Which link is *this* application. Read once from the document's base URI rather than from the
   * router, because the thing being matched is the app's own mount point, not its current route —
   * and because a base URI exists on a server too.
   */
  private readonly basePath = toDirectoryPath(this.doc.baseURI ?? '/');

  protected readonly navOpen = signal(false);

  /**
   * The list to render, or `undefined` for "nobody has answered yet".
   *
   * There is deliberately **no compiled-in fallback list**. Shipping the platform's front doors
   * here as a safety net would put back the exact defect this replaced *and hide it*: the chrome
   * would sometimes show what the platform routes and sometimes a guess frozen at release time,
   * with nothing on screen telling the two apart. An honest empty state is worth more than a
   * plausible wrong one — so a source that answers with nothing strands the reader visibly.
   */
  private readonly resolved = computed<readonly QitsNavLink[] | undefined>(() => {
    const own = this.links();
    // `own?.length`, not `own.length`: `withComponentInputBinding()` writes `undefined` into a route
    // component's inputs for every route parameter it cannot supply, and it has wiped this one
    // before. An input with a default is not a guarantee of a value.
    if (own?.length) return own;
    // No provider at all is not "waiting" — nothing is coming. Strand it rather than spin forever.
    return this.source ? this.source.links() : [];
  });

  /** Nothing has answered yet: render no links and say so on the `<nav>`. */
  protected readonly pending = computed(() => this.resolved() === undefined);

  /** Answered, but with nothing — an empty list or a request that failed. */
  protected readonly stranded = computed(() => this.resolved()?.length === 0);

  protected readonly navLinks = computed(() =>
    (this.resolved() ?? []).map((link) => ({
      ...link,
      current: toDirectoryPath(link.href) === this.basePath,
    })),
  );

  /**
   * Whether any entry is this application. False whenever nothing in the list is where this app is
   * served from: the gateway does not route it yet, or it is a bare `ng serve` on a port of its own.
   * The sub-menu still has to go somewhere, so it goes to the foot of the navigation rather than
   * nowhere — the two placements are mutually exclusive by construction, so it is instantiated at
   * most once either way.
   */
  protected readonly hasCurrent = computed(() => this.navLinks().some((link) => link.current));

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  /** A link is a full-document navigation, but the panel must not be left open behind it. */
  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /**
   * Close the mobile panel for a sub-menu *link*, and nothing else. A sub-menu is a tree, not a
   * list of destinations: closing on every click would collapse the whole panel the moment someone
   * expanded a group to look inside it.
   */
  protected onSubmenuNavigate(event: Event): void {
    if ((event.target as Element | null)?.closest('a')) this.closeNav();
  }
}
