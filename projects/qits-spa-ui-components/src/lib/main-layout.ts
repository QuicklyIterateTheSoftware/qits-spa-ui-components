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

import { QitsAppLinks, QITS_BROWSER_ORIGIN } from './app-links';
import { QitsNavSubmenuSlot } from './nav-submenu';
import { QITS_NAVIGATION, type QitsNavLink, type QitsNavSlot } from './navigation';
import { QitsPicker, type QitsPickerOption } from './picker';
import { QITS_PROJECTS } from './projects';
import { QITS_REPOSITORIES } from './repositories';
import { QITS_CATEGORIES, QITS_SCOPE, scopePath, type QitsScope } from './scope';

/** `/ci` and `/ci/` name the same application; comparing normalised paths keeps the match honest. */
function toDirectoryPath(href: string): string {
  const { pathname } = new URL(href || '/', 'http://qits.invalid');
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/** The host part of an origin, port included — or `undefined` for something that is not one. */
function hostOf(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

/**
 * An address on the projects host: its origin, the scope path, then `path`. With no origin known
 * the path stands alone, which is right on the projects host itself and the best that can be said
 * anywhere else.
 */
function link(origin: string | undefined, scope: QitsScope, path: string): string {
  const tail = `${scopePath(scope)}${path.replace(/^\/+/, '')}`;
  return origin ? `${origin.replace(/\/+$/, '')}${tail}` : tail;
}

/** One line of the sidebar. Headings and notes are rows too, so the order is stated in one list. */
interface QitsNavRow {
  readonly kind: 'heading' | 'link' | 'note' | 'alert';
  /** Unique, and what the sub-menu is placed by. */
  readonly key: string;
  readonly label: string;
  readonly href?: string;
  readonly current?: boolean;
  /** A row belonging to the one above it: indented, and only ever one level deep. */
  readonly child?: boolean;
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
 * **The sidebar is a tree of what is in scope, not a list of applications.** Every service is its
 * own host and every SPA shares one URL grammar — `/<project>/<category>/<repository>/…` — so the
 * chrome can name the project, its repositories by group, and under the repository on screen the
 * applications that have something to say about it. Which applications those are is the platform's
 * knowledge, asked for through `QITS_NAVIGATION`; which repositories exist is qits-projects', asked
 * for through `QITS_REPOSITORIES`; what is in scope is the address's, read through `QITS_SCOPE`.
 * Nothing of the three is compiled in, because a list compiled into this package is a second source
 * of truth for the platform's own topology and it will lag the first one.
 *
 * The links leave the SPA on purpose. Each destination is its own Angular application on its own
 * host, so they are plain `<a href>` full-document navigations — `routerLink` would look right and
 * go nowhere.
 *
 * An edge that predates slots answers the flat `{links}` shape, and the sidebar then draws exactly
 * the list it always drew. That is the one release the two shapes overlap for.
 *
 * Under the row that is this page, an app can hang a sub-menu of its own —
 * `<ng-template qitsNavSubmenu>` in the shell, see {@link QitsNavSubmenu}. The layout gives it a
 * bare block and styles nothing inside it.
 *
 * **The top-left slot is the project picker, not a wordmark.** Every resource this platform holds
 * belongs to a project, so which project is being looked at is the outermost thing about a page and
 * not a filter inside one of them. An app that provides no `QITS_PROJECTS` still gets `brand()`
 * there, which is what keeps this a slot rather than a requirement.
 */
@Component({
  selector: 'qits-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NgTemplateOutlet, QitsPicker],
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

        @if (hasPicker) {
          <div class="qits-layout-project">
            @if (projectsPending()) {
              <p class="qits-layout-project-note">Loading projects…</p>
            } @else if (projectsFailed()) {
              <p class="qits-layout-project-note qits-layout-project-error" role="alert">
                Could not load projects.
              </p>
            } @else {
              <qits-picker
                [options]="projectOptions()"
                [value]="projectSlug()"
                (valueChange)="onProject($event)"
                ariaLabel="Project"
                placeholder="Pick a project"
                emptyLabel="No projects yet"
              />
            }
          </div>
        } @else {
          <span class="qits-layout-brand">{{ brand() }}</span>
        }
      </header>

      <nav
        id="qits-layout-nav"
        class="qits-layout-nav"
        [class.qits-layout-nav-open]="navOpen()"
        [attr.aria-label]="brand() + ' navigation'"
        [attr.aria-busy]="pending() ? 'true' : null"
      >
        <ul class="qits-layout-links">
          @for (row of rows(); track row.key) {
            <li>
              @switch (row.kind) {
                @case ('heading') {
                  <p class="qits-layout-heading">{{ row.label }}</p>
                }
                @case ('note') {
                  <p class="qits-layout-note">{{ row.label }}</p>
                }
                @case ('alert') {
                  <p class="qits-layout-note qits-layout-alert" role="alert">{{ row.label }}</p>
                }
                @default {
                  <a
                    class="qits-layout-link"
                    [class.qits-layout-link-child]="row.child"
                    [class.qits-layout-link-current]="row.current"
                    [href]="row.href"
                    [attr.aria-current]="row.current ? 'page' : null"
                    (click)="closeNav()"
                    >{{ row.label }}</a
                  >
                }
              }
              @if (row.key === currentKey()) {
                <!-- Two nested @if rather than one condition: \`… && submenu()\` narrows to
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
      /* Top, not centre: with nothing picked the picker *is* its own list, so this row is as tall
         as the projects there are. Centring would hang the burger halfway down that list. */
      align-items: flex-start;
      gap: 10px;
      padding: 10px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .qits-layout-brand {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .qits-layout-burger {
      font: inherit;
      font-size: 18px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      /* Matched to the picker's pill so the two line up on the first row of a bar that may be tall. */
      min-height: 34px;
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
    /* The picker takes the width the wordmark did not need, and caps its own height rather than the
       bar's: a platform with fifty projects must not push the navigation off the screen, and the
       bar is not the element that scrolls. */
    .qits-layout-project {
      flex: 1;
      min-width: 0;
      max-height: 60vh;
      overflow-y: auto;
    }
    .qits-layout-project-note {
      margin: 0;
      padding: 8px 2px;
      font-size: 13px;
      color: #6b7280;
    }
    .qits-layout-project-error {
      color: #b91c1c;
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
    /* A child belongs to the row above it, so it is indented and quieter — not a second style of
       link. The rail is what makes a group of them read as one block. */
    .qits-layout-link-child {
      margin-left: 10px;
      padding-left: 12px;
      border-left: 2px solid #e5e7eb;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
    }
    /* A heading is a label, not a target: small caps, no hover, and enough space above it that the
       group below reads as belonging to it. */
    .qits-layout-heading {
      margin: 10px 0 2px;
      padding: 0 10px;
      color: #9ca3af;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .qits-layout-links > li:first-child .qits-layout-heading {
      margin-top: 0;
    }
    .qits-layout-note {
      margin: 0;
      padding: 6px 10px;
      font-size: 13px;
      color: #6b7280;
    }
    .qits-layout-alert {
      color: #b91c1c;
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
   * An explicit override of the platform navigation, in the **flat** shape. Left empty — the
   * default — the layout asks `QITS_NAVIGATION` instead. A **non-empty** list wins outright and the
   * source is not consulted at all, which is what lets a story, a spec or an `ng serve` with no
   * platform in front of it render the real chrome with no provider anywhere.
   */
  readonly links = input<readonly QitsNavLink[]>([]);

  private readonly doc = inject(DOCUMENT);
  private readonly appLinks = inject(QitsAppLinks);
  private readonly browserOrigin = inject(QITS_BROWSER_ORIGIN);
  /**
   * Optional on purpose. An app that forgets the provider lands in the stranded state below — one
   * way out, and a line saying so — rather than failing to bootstrap at all with NG0201.
   */
  private readonly source = inject(QITS_NAVIGATION, { optional: true });

  /** What an application hung under its own row, if anything. */
  protected readonly submenu = inject(QitsNavSubmenuSlot).template;

  /**
   * The three reads the chrome does, all optional, and all absent is the state every SPA was in
   * before any of this: a flat list of doors and a wordmark.
   *
   * They are separate because they answer different questions from different places: the *list of
   * projects* is the platform's, *which one is open* is the address's, and *what is inside it* is
   * qits-projects' answer about that one project.
   */
  private readonly projects = inject(QITS_PROJECTS, { optional: true });
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });
  private readonly repositories = inject(QITS_REPOSITORIES, { optional: true });

  /**
   * Whether the slot is the picker rather than the wordmark. Read once, not computed: an app either
   * wired the picker up at bootstrap or it did not, and the slot must not swap under a reader.
   *
   * Both halves are required. A picker with a list but no scope could show what exists and neither
   * say which is open nor act on a pick — a dead control in the most prominent place in the chrome,
   * which is worse than the brand text it would have replaced.
   */
  protected readonly hasPicker = this.projects !== null && this.scopeSource !== null;

  /**
   * Which link is *this* application in the flat shape. Read once from the document's base URI
   * rather than from the router, because the thing being matched is the app's own mount point, not
   * its current route — and because a base URI exists on a server too.
   */
  private readonly basePath = toDirectoryPath(this.doc.baseURI ?? '/');

  protected readonly navOpen = signal(false);

  /**
   * What the platform answered, or `undefined` for "nobody has answered yet".
   *
   * There is deliberately **no compiled-in fallback**. Shipping the platform's front doors here as
   * a safety net would put back the exact defect this replaced *and hide it*: the chrome would
   * sometimes show what the platform routes and sometimes a guess frozen at release time, with
   * nothing on screen telling the two apart.
   */
  private readonly tree = computed(() => {
    const own = this.links();
    // `own?.length`, not `own.length`: `withComponentInputBinding()` writes `undefined` into a route
    // component's inputs for every route parameter it cannot supply, and it has wiped this one
    // before. An input with a default is not a guarantee of a value.
    if (own?.length) return { entries: [], environmentOrigin: undefined, legacy: own };
    // No provider at all is not "waiting" — nothing is coming. Strand it rather than spin forever.
    return this.source
      ? this.source.tree()
      : { entries: [], environmentOrigin: undefined, legacy: [] };
  });

  /** Nothing has answered yet: render nothing and say so on the `<nav>`. */
  protected readonly pending = computed(() => this.tree() === undefined);

  /** Answered, and there is nothing to draw — an empty platform, or a request that failed. */
  protected readonly stranded = computed(() => !this.pending() && this.rows().length === 0);

  /** Where qits-projects is served: by name, or by the host it is known to answer on. */
  private readonly projectsOrigin = computed(
    () =>
      this.appLinks.origin('qits-projects') ??
      this.tree()?.entries.find((entry) => entry.host === 'projects')?.origin,
  );

  private readonly onProjectsHost = computed(() => {
    const host = hostOf(this.projectsOrigin());
    return host !== undefined && host === hostOf(this.browserOrigin);
  });

  /** What the address says is on screen. Empty where an app provided no scope at all. */
  private readonly scope = computed<QitsScope>(() => this.scopeSource?.scope() ?? {});

  /**
   * The sidebar, top to bottom.
   *
   * <p><b>The most specific row wins.</b> The rows are built deepest-first — a repository under its
   * group, a group under the project, the platform-wide groups last — and at most one of them is
   * marked current, the first. Two rows claiming the page would be two answers to "where am I", and
   * the sub-menu would have two places to go.
   */
  protected readonly rows = computed<readonly QitsNavRow[]>(() => {
    const legacy = this.tree()?.legacy;
    if (legacy) {
      return legacy.map((link) => ({
        kind: 'link' as const,
        key: link.href,
        label: link.label,
        href: link.href,
        current: toDirectoryPath(link.href) === this.basePath,
      }));
    }
    return firstCurrentOnly(this.treeRows());
  });

  /** The row the sub-menu hangs under, if any row is this page. */
  protected readonly currentKey = computed(() => this.rows().find((row) => row.current)?.key);

  /**
   * Whether any row is this page. False on a bare `ng serve`, on an app the platform does not serve
   * yet, and wherever the answer is flat and names no address of ours. The sub-menu still has to go
   * somewhere, so it goes to the foot of the navigation rather than nowhere.
   */
  protected readonly hasCurrent = computed(() => this.currentKey() !== undefined);

  /** Nothing has answered with a project list yet. */
  protected readonly projectsPending = computed(() => this.projects?.projects() === undefined);

  /** The read failed. Said out loud rather than drawn as an empty list, which would be a lie. */
  protected readonly projectsFailed = computed(() => this.projects?.failed() ?? false);

  protected readonly projectOptions = computed<QitsPickerOption<string>[]>(() =>
    (this.projects?.projects() ?? []).map((project) => ({
      value: project.slug,
      label: project.name,
    })),
  );

  /**
   * The project on screen, as the scope reports it — never stored here, and named by its slug
   * because that is what the address says.
   *
   * A slug the list does not contain is passed through rather than blanked: `QitsPicker` resolves a
   * value against its options and shows the list again when nothing matches, so a URL naming a
   * project that no longer exists lands on the choices instead of a pill with no label.
   */
  protected readonly projectSlug = computed(() => this.scope().project);

  protected onProject(projectSlug: string | undefined): void {
    this.scopeSource?.select(projectSlug);
    // A pick is a navigation, so the mobile panel must not be left open on top of where it went.
    this.closeNav();
  }

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

  /** The nested sidebar: the project, its repositories by group, then the platform-wide groups. */
  private treeRows(): QitsNavRow[] {
    const scope = this.scope();
    const project = scope.project;
    const rows: QitsNavRow[] = [];
    if (project) {
      rows.push(...this.projectRows(project, scope));
      rows.push(...this.repositoryRows(project, scope));
      rows.push(...this.group('PLATFORM', 'platform', { project }));
    }
    rows.push(...this.group('SYSTEM', 'system', {}));
    return rows;
  }

  /** The Project node and what belongs to the project rather than to one of its repositories. */
  private projectRows(project: string, scope: QitsScope): QitsNavRow[] {
    const origin = this.projectsOrigin();
    const setup = link(origin, { project }, 'project-setup');
    const children: QitsNavRow[] = [
      {
        kind: 'link',
        key: 'project-setup',
        label: 'Project setup',
        href: setup,
        current:
          this.onProjectsHost() &&
          this.appLinks.currentPath().startsWith(`/${project}/project-setup`),
        child: true,
      },
      ...this.entryRows('project.detail', { project }, 'project.detail'),
    ];
    return [
      {
        kind: 'link',
        key: 'project',
        label: 'Project',
        href: link(origin, { project }, ''),
        // The project itself, unless something inside it is the page — the deepest row wins.
        current:
          this.onProjectsHost() && !scope.category && !children.some((child) => child.current),
      },
      ...children,
    ];
  }

  /**
   * One group per category that has repositories, and under the repository in scope the
   * applications that have something to say about it.
   *
   * The children hang off the repository in scope alone. A tree that opened every repository would
   * be as long as the project is big, and it would say nothing about where the reader is.
   */
  private repositoryRows(project: string, scope: QitsScope): QitsNavRow[] {
    if (!this.repositories) return [];
    if (this.repositories.repositories() === undefined) {
      return [{ kind: 'note', key: 'repositories-pending', label: 'Loading repositories…' }];
    }
    if (this.repositories.failed()) {
      return [{ kind: 'alert', key: 'repositories-failed', label: 'Could not load repositories.' }];
    }
    const all = this.repositories.repositories() ?? [];
    const origin = this.projectsOrigin();
    const rows: QitsNavRow[] = [];
    for (const category of QITS_CATEGORIES) {
      // By name, not in the order the API answered: a sidebar a reader scans has to be predictable,
      // and case is not a fact about a repository worth ordering by.
      const inGroup = all
        .filter((repository) => repository.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      if (inGroup.length === 0) continue;
      rows.push({ kind: 'heading', key: `heading:${category}`, label: category.toUpperCase() });
      for (const repository of inGroup) {
        const open = scope.category === category && scope.repository === repository.name;
        const inScope: QitsScope = { project, category, repository: repository.name };
        // `scoped: false` — an application with no host has no address for this repository, so its
        // row leads to its front page and says nothing about where the reader is.
        const children = open
          ? this.entryRows(`${category}.details`, inScope, `${category}.details`, true, false)
          : [];
        rows.push({
          kind: 'link',
          key: `repository:${category}/${repository.name}`,
          label: repository.name,
          href: link(origin, inScope, ''),
          current: open && this.onProjectsHost() && !children.some((child) => child.current),
        });
        rows.push(...children);
      }
    }
    return rows;
  }

  /** A heading and the entries of one slot, or nothing at all where the slot is empty. */
  private group(heading: string, slot: QitsNavSlot, scope: QitsScope): QitsNavRow[] {
    const rows = this.entryRows(slot, scope, slot, false);
    return rows.length === 0
      ? []
      : [{ kind: 'heading', key: `heading:${slot}`, label: heading }, ...rows];
  }

  /**
   * The entries of one slot as rows.
   *
   * An application the platform serves on **no host of its own** is drawn all the same, at its own
   * segment under the environment origin — `QitsAppLinks.href` drops the scope for it, because such
   * an application has no scoped address. `scoped` is how the caller says that dropping the scope
   * would be a lie rather than a fallback: under a repository, an unscoped link goes to the
   * application's front page, so it is drawn but never marked as the repository on screen.
   */
  private entryRows(
    slot: QitsNavSlot,
    scope: QitsScope,
    keyPrefix: string,
    child = true,
    scoped = true,
  ): QitsNavRow[] {
    const rows: QitsNavRow[] = [];
    for (const entry of this.appLinks.entries(slot)) {
      const href = this.appLinks.href(entry.app, '', scope);
      if (!href) continue;
      rows.push({
        kind: 'link',
        key: `${keyPrefix}:${entry.app}`,
        label: entry.label,
        href,
        current: (scoped || entry.host !== null) && this.appLinks.isCurrent(entry, scope),
        child,
      });
    }
    return rows;
  }
}

/** At most one row is the page, and it is the first — the rows are ordered most specific first. */
function firstCurrentOnly(rows: readonly QitsNavRow[]): QitsNavRow[] {
  let seen = false;
  return rows.map((row) => {
    if (!row.current) return row;
    if (seen) return { ...row, current: false };
    seen = true;
    return row;
  });
}
