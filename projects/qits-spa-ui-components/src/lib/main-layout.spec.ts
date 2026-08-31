import { provideLocationMocks } from '@angular/common/testing';
import { Component, signal, viewChild, type TemplateRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { QITS_BROWSER_ORIGIN } from './app-links';
import { QitsMainLayout } from './main-layout';
import { QitsNavSubmenuSlot } from './nav-submenu';
import {
  provideQitsNavigationLinks,
  provideQitsNavigationTree,
  QITS_NAVIGATION,
  type QitsNavigation,
  type QitsNavLink,
} from './navigation';
import { provideQitsProjectList, QITS_PROJECTS, type QitsProject } from './projects';
import { provideQitsRepositoryList, QITS_REPOSITORIES, type QitsRepository } from './repositories';
import { provideQitsScope, type QitsRouting } from './scope';

describe('QitsMainLayout', () => {
  const PLATFORM: readonly QitsNavLink[] = [
    { label: 'Home', href: '/' },
    { label: 'CI', href: '/ci/' },
    { label: 'Docs', href: '/platform-docs/' },
  ];

  /**
   * The layout hosts a `<router-outlet />`, so it needs a router even with nothing to route to.
   * The literal source stands in for the edge: nothing is fetched, so there is no request to
   * flush before an assertion and no pending task to wait on.
   */
  function render(links: readonly QitsNavLink[] = PLATFORM): ComponentFixture<QitsMainLayout> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideQitsNavigationLinks(links)],
    });
    const fixture = TestBed.createComponent(QitsMainLayout);
    fixture.detectChanges();
    return fixture;
  }

  function burger(fixture: ComponentFixture<unknown>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.qits-layout-burger') as HTMLButtonElement;
  }

  /**
   * The navigation entries, and only those — anchored at the list so an anchor a sub-menu fixture
   * puts inside the same `<li>` can never be counted as a platform link.
   */
  function links(fixture: ComponentFixture<unknown>): HTMLAnchorElement[] {
    return [
      ...fixture.nativeElement.querySelectorAll('.qits-layout-links > li > .qits-layout-link'),
    ] as HTMLAnchorElement[];
  }

  function labels(fixture: ComponentFixture<unknown>): (string | undefined)[] {
    return links(fixture).map((a) => a.textContent?.trim());
  }

  function headings(fixture: ComponentFixture<unknown>): (string | undefined)[] {
    return [...fixture.nativeElement.querySelectorAll('.qits-layout-heading')].map((p) =>
      (p as HTMLElement).textContent?.trim(),
    );
  }

  function current(fixture: ComponentFixture<unknown>): (string | undefined)[] {
    return links(fixture)
      .filter((a) => a.getAttribute('aria-current') === 'page')
      .map((a) => a.textContent?.trim());
  }

  describe('the flat shape an edge without slots answers', () => {
    it('renders what the navigation source gives it, as plain hrefs', () => {
      const anchors = links(render());
      expect(anchors.map((a) => a.textContent?.trim())).toEqual(['Home', 'CI', 'Docs']);
      expect(anchors.map((a) => a.getAttribute('href'))).toEqual(PLATFORM.map((link) => link.href));
      // routerLink would compile and go nowhere: these destinations are other applications.
      expect(anchors.some((a) => a.hasAttribute('ng-reflect-router-link'))).toBe(false);
    });

    it('marks the link matching the document base as the current page, and only that one', () => {
      const fixture = render();
      // jsdom serves the specs from the site root, so Home is the app we are in.
      expect(current(fixture)).toEqual(['Home']);
      expect(links(fixture)[0].classList).toContain('qits-layout-link-current');
      expect(links(fixture)[1].getAttribute('aria-current')).toBeNull();
    });

    it('lets a non-empty [links] beat the source outright', () => {
      const fixture = render();
      fixture.componentRef.setInput('links', [{ label: 'Docs', href: '/docs/' }]);
      fixture.detectChanges();
      expect(labels(fixture)).toEqual(['Docs']);

      // Empty is the default, not an override: the source comes back rather than the nav emptying.
      fixture.componentRef.setInput('links', []);
      fixture.detectChanges();
      expect(labels(fixture)).toEqual(['Home', 'CI', 'Docs']);
    });
  });

  it('brands the bar, defaulting to qits, and names the nav after it', () => {
    const fixture = render();
    const brand = fixture.nativeElement.querySelector('.qits-layout-brand') as HTMLElement;
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(brand.textContent).toBe('qits');
    expect(nav.getAttribute('aria-label')).toBe('qits navigation');

    fixture.componentRef.setInput('brand', 'qits ci');
    fixture.detectChanges();
    expect(brand.textContent).toBe('qits ci');
    expect(nav.getAttribute('aria-label')).toBe('qits ci navigation');
  });

  it('renders nothing and says it is busy until the source answers', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QITS_NAVIGATION, useValue: { tree: signal(undefined), failed: signal(false) } },
      ],
    });
    const fixture = TestBed.createComponent(QitsMainLayout);
    fixture.detectChanges();

    expect(links(fixture)).toEqual([]);
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-busy')).toBe('true');
    // Waiting is not stranded: no escape link, because one may still be on its way.
    expect(fixture.nativeElement.querySelector('.qits-layout-escape')).toBeNull();
  });

  it('offers one way out when the answer is empty, and no compiled-in list', () => {
    const fixture = render([]);
    const escape = fixture.nativeElement.querySelector('.qits-layout-escape') as HTMLAnchorElement;

    expect(links(fixture)).toEqual([]);
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-busy')).toBeNull();
    expect(fixture.nativeElement.querySelector('.qits-layout-stranded')?.textContent).toBe(
      'Navigation unavailable',
    );
    // `/` is the platform's own root, not a registry entry, so this fallback cannot go stale.
    expect(escape.getAttribute('href')).toBe('/');
  });

  it('strands an app that never provided a source, rather than failing to bootstrap', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(QitsMainLayout);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.qits-layout-escape')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-busy')).toBeNull();
  });

  it('starts closed, and the burger says so', () => {
    const fixture = render();
    expect(burger(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(burger(fixture).getAttribute('aria-label')).toBe('Toggle navigation');
    expect(burger(fixture).getAttribute('aria-controls')).toBe('qits-layout-nav');
    expect(fixture.nativeElement.querySelector('nav').id).toBe('qits-layout-nav');
    expect(fixture.nativeElement.querySelector('.qits-layout-nav-open')).toBeNull();
  });

  it('the burger toggles the nav both ways', () => {
    const fixture = render();
    burger(fixture).click();
    fixture.detectChanges();
    expect(burger(fixture).getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.qits-layout-nav-open')).not.toBeNull();

    burger(fixture).click();
    fixture.detectChanges();
    expect(burger(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.qits-layout-nav-open')).toBeNull();
  });

  it('closes the nav when a link is followed', () => {
    const fixture = render();
    burger(fixture).click();
    fixture.detectChanges();

    // The component must *not* cancel the navigation — that is the whole point of these links — so
    // the spec cancels it one level up, after the handler has run and before jsdom complains.
    fixture.nativeElement.addEventListener('click', (event: Event) => event.preventDefault());
    links(fixture)[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(burger(fixture).getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.qits-layout-nav-open')).toBeNull();
  });

  it('mounts the outlet the child routes render into', () => {
    const fixture = render();
    const content = fixture.nativeElement.querySelector('main.qits-layout-content') as HTMLElement;
    expect(content.querySelector('router-outlet')).not.toBeNull();
  });

  /**
   * The nested sidebar: what the platform serves, filed under what the address says is on screen.
   * Not "does the navigation work" — that is `toNavTree`'s and `QitsAppLinks`' own specs — but the
   * shape this layout builds out of the three reads.
   */
  describe('the scoped sidebar', () => {
    @Component({ template: '' })
    class Blank {}

    const PROJECTS_ORIGIN = 'https://projects.dev.example.com';
    const CI_ORIGIN = 'https://ci.dev.example.com';
    const ENVIRONMENT_ORIGIN = 'https://dev.example.com';

    const TREE: QitsNavigation = {
      environment: 'dev',
      origin: 'https://dev.example.com',
      slots: {
        system: [
          {
            app: 'qits-projects',
            label: 'Overview',
            host: 'projects',
            path: '/projects',
            origin: PROJECTS_ORIGIN,
            position: 1,
          },
          // Not flipped yet: no host of its own, so the environment origin and its own segment.
          {
            app: 'qits-platform-system',
            label: 'System',
            host: null,
            path: '/system',
            origin: ENVIRONMENT_ORIGIN,
            position: 4,
          },
        ],
        platform: [
          {
            app: 'qits-platform-events',
            label: 'Events',
            host: 'events',
            path: '/events',
            origin: 'https://events.dev.example.com',
            position: 1,
          },
        ],
        'project.detail': [
          {
            app: 'qits-workspaces',
            label: 'Workspaces',
            host: 'workspaces',
            path: '/workspaces',
            origin: 'https://workspaces.dev.example.com',
            position: 1,
          },
        ],
        'services.details': [
          { app: 'qits-ci', label: 'CI', host: 'ci', path: '/ci', origin: CI_ORIGIN, position: 2 },
          {
            app: 'qits-artifacts',
            label: 'Artifacts',
            host: null,
            path: '/artifacts',
            origin: ENVIRONMENT_ORIGIN,
            position: 3,
          },
          {
            app: 'qits-docs',
            label: 'Docs',
            host: 'docs',
            path: '/docs',
            origin: 'https://docs.dev.example.com',
            position: 1,
          },
          // A subpathed entry: it opens a view of the projects app under the scope, not its root.
          {
            app: 'qits-projects',
            label: 'Api Docs',
            host: 'projects',
            path: '/projects',
            origin: PROJECTS_ORIGIN,
            position: 6,
            subpath: 'api-docs',
          },
        ],
        'libs.details': [
          {
            app: 'qits-docs',
            label: 'Docs',
            host: 'docs',
            path: '/docs',
            origin: 'https://docs.dev.example.com',
            position: 1,
          },
        ],
      },
    };

    const PROJECTS: readonly QitsProject[] = [
      { id: 'p1', slug: 'qits', name: 'qits' },
      { id: 'p2', slug: 'payments', name: 'Payments' },
    ];

    /** Deliberately not in name order, and not in one case: the sidebar sorts, the API does not. */
    const REPOSITORIES: readonly QitsRepository[] = [
      { id: 'r2', name: 'qits-projects', category: 'services' },
      { id: 'r5', name: 'Qits-web', category: 'services' },
      { id: 'r1', name: 'qits-ci', category: 'services' },
      { id: 'r3', name: 'qits-eventstream', category: 'libs' },
      { id: 'r4', name: 'qits-qits', category: undefined },
    ];

    async function renderTree(options?: {
      readonly url?: string;
      readonly browserOrigin?: string;
      readonly routing?: QitsRouting;
      readonly repositories?: readonly QitsRepository[];
      readonly repositoriesFailed?: boolean;
      readonly pendingRepositories?: boolean;
    }): Promise<ComponentFixture<QitsMainLayout>> {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', component: Blank }]),
          provideLocationMocks(),
          provideQitsNavigationTree(TREE),
          provideQitsProjectList(PROJECTS),
          options?.pendingRepositories
            ? {
                provide: QITS_REPOSITORIES,
                useValue: {
                  repositories: signal<readonly QitsRepository[] | undefined>(undefined),
                  wrapperRepositoryId: signal(undefined),
                  failed: signal(false),
                },
              }
            : provideQitsRepositoryList(options?.repositories ?? REPOSITORIES, 'r9', {
                failed: options?.repositoriesFailed,
              }),
          provideQitsScope(options?.routing ?? 'repository'),
          { provide: QITS_BROWSER_ORIGIN, useValue: options?.browserOrigin ?? PROJECTS_ORIGIN },
        ],
      });
      await TestBed.inject(Router).navigateByUrl(options?.url ?? '/');
      const fixture = TestBed.createComponent(QitsMainLayout);
      fixture.detectChanges();
      return fixture;
    }

    it('shows only the platform-wide group while no project is in scope', async () => {
      const fixture = await renderTree();
      // No project: no Project node, no repository groups, and PLATFORM is about a project.
      expect(headings(fixture)).toEqual(['SYSTEM']);
      expect(labels(fixture)).toEqual(['Overview', 'System']);
    });

    it('draws the project, its repositories by group, then the platform-wide groups', async () => {
      const fixture = await renderTree({ url: '/qits/' });

      expect(headings(fixture)).toEqual(['SERVICES', 'LIBS', 'PLATFORM', 'SYSTEM']);
      expect(labels(fixture)).toEqual([
        'Project',
        'Project setup',
        'Workspaces',
        'qits-ci',
        'qits-projects',
        'Qits-web',
        'qits-eventstream',
        'Events',
        'Overview',
        'System',
      ]);
      // A repository of an archetype this library does not group is left out rather than guessed at.
      expect(labels(fixture)).not.toContain('qits-qits');
    });

    /** A reader scans this list; the order an API answered in is not one they can predict. */
    it('lists the repositories of a group by name, whatever case they are in', async () => {
      const fixture = await renderTree({ url: '/qits/' });
      const names = labels(fixture).filter((label) => label?.toLowerCase().startsWith('qits-'));

      expect(names).toEqual(['qits-ci', 'qits-projects', 'Qits-web', 'qits-eventstream']);
    });

    it('addresses every row on the host that serves it', async () => {
      const fixture = await renderTree({ url: '/qits/' });
      const href = (label: string) =>
        links(fixture)
          .find((a) => a.textContent?.trim() === label)
          ?.getAttribute('href');

      expect(href('Project')).toBe(`${PROJECTS_ORIGIN}/qits/`);
      expect(href('Project setup')).toBe(`${PROJECTS_ORIGIN}/qits/project-setup`);
      expect(href('Workspaces')).toBe('https://workspaces.dev.example.com/qits/');
      expect(href('qits-ci')).toBe(`${PROJECTS_ORIGIN}/qits/services/qits-ci/`);
      expect(href('Events')).toBe('https://events.dev.example.com/qits/');
      // No host of its own: the environment origin, at the segment the platform says it answers on.
      expect(href('System')).toBe(`${ENVIRONMENT_ORIGIN}/system/`);
    });

    it('is the Project itself on the projects host, with no category in scope', async () => {
      const fixture = await renderTree({ url: '/qits/' });
      expect(current(fixture)).toEqual(['Project']);
    });

    it('opens the repository in scope, and only that one', async () => {
      const fixture = await renderTree({ url: '/qits/services/qits-ci/' });

      expect(labels(fixture)).toEqual([
        'Project',
        'Project setup',
        'Workspaces',
        'qits-ci',
        'Docs',
        'CI',
        'Artifacts',
        'Api Docs',
        'qits-projects',
        'Qits-web',
        'qits-eventstream',
        'Events',
        'Overview',
        'System',
      ]);
      // The open row's children are the entries of *its* category, in the platform's order.
      const children = links(fixture).filter((a) => a.classList.contains('qits-layout-link-child'));
      expect(children.map((a) => a.textContent?.trim())).toEqual([
        'Project setup',
        'Workspaces',
        'Docs',
        'CI',
        'Artifacts',
        'Api Docs',
      ]);
      expect(current(fixture)).toEqual(['qits-ci']);
    });

    it('addresses a subpathed entry at its view under the scope, and marks it the page there', async () => {
      const fixture = await renderTree({
        url: '/qits/services/qits-ci/api-docs',
        browserOrigin: PROJECTS_ORIGIN,
      });

      // The subpath rides after the scope: the entry opens a view of its app for this repository.
      expect(
        links(fixture)
          .find((a) => a.textContent?.trim() === 'Api Docs')
          ?.getAttribute('href'),
      ).toBe(`${PROJECTS_ORIGIN}/qits/services/qits-ci/api-docs`);
      expect(current(fixture)).toEqual(['Api Docs']);
    });

    it('marks the entry whose host the reader is on, inside the repository in scope', async () => {
      const fixture = await renderTree({
        url: '/qits/services/qits-ci/runs/7',
        browserOrigin: CI_ORIGIN,
      });

      // On the ci host the repository row is a link away, and the CI entry is the page.
      expect(current(fixture)).toEqual(['CI']);
      expect(
        links(fixture)
          .find((a) => a.textContent?.trim() === 'CI')
          ?.getAttribute('href'),
      ).toBe(`${CI_ORIGIN}/qits/services/qits-ci/`);
    });

    /** An application the platform has not flipped yet is drawn all the same, at its own segment. */
    it('marks an unflipped application current on the environment origin, under its segment', async () => {
      const fixture = await renderTree({ url: '/system/nodes', browserOrigin: ENVIRONMENT_ORIGIN });

      expect(
        links(fixture)
          .find((a) => a.textContent?.trim() === 'System')
          ?.getAttribute('href'),
      ).toBe(`${ENVIRONMENT_ORIGIN}/system/`);
      expect(current(fixture)).toEqual(['System']);
    });

    /**
     * Under a repository the same application has nothing scoped to point at, so the row goes to
     * its front page — and says nothing about the repository on screen, which it cannot show.
     */
    it('links an unflipped application unscoped under a repository, and never as the page', async () => {
      const fixture = await renderTree({
        url: '/qits/services/qits-ci/',
        browserOrigin: ENVIRONMENT_ORIGIN,
      });
      const artifacts = links(fixture).find((a) => a.textContent?.trim() === 'Artifacts');

      expect(artifacts?.getAttribute('href')).toBe(`${ENVIRONMENT_ORIGIN}/artifacts/`);
      expect(artifacts?.getAttribute('aria-current')).toBeNull();
    });

    /**
     * The heart of the reorganisation: a repository draws under its component, and the archetype
     * categories are what is left for the rows the platform has not given one.
     */
    describe('grouped by component', () => {
      /** A half-migrated platform: two components, and two repositories still only archetyped. */
      const MIXED: readonly QitsRepository[] = [
        { id: 'r1', name: 'qits-ci-service', component: 'qits-ci', category: 'services' },
        { id: 'r2', name: 'qits-ci-daemon', component: 'qits-ci', category: 'daemons' },
        {
          id: 'r3',
          name: 'qits-artifacts-service',
          component: 'qits-artifacts',
          category: 'services',
        },
        { id: 'r4', name: 'qits-eventstream', category: 'libs' },
        { id: 'r5', name: 'qits-spa-home', category: 'frontends' },
      ];

      it('draws the components first, in name order, then what is left of the categories', async () => {
        const fixture = await renderTree({ url: '/qits/', repositories: MIXED });

        expect(headings(fixture)).toEqual([
          'qits-artifacts',
          'qits-ci',
          'LIBS',
          'FRONTENDS',
          'PLATFORM',
          'SYSTEM',
        ]);
        expect(labels(fixture)).toEqual([
          'Project',
          'Project setup',
          'Workspaces',
          'qits-artifacts-service',
          // Both repositories of the component sit together, whatever their archetypes are.
          'qits-ci-daemon',
          'qits-ci-service',
          'qits-eventstream',
          'qits-spa-home',
          'Events',
          'Overview',
          'System',
        ]);
      });

      it('draws no category group at all once every repository has a component', async () => {
        const fixture = await renderTree({
          url: '/qits/',
          repositories: MIXED.filter((repository) => repository.component),
        });
        expect(headings(fixture)).toEqual(['qits-artifacts', 'qits-ci', 'PLATFORM', 'SYSTEM']);
      });

      it('addresses a repository by its component, and one without by its category', async () => {
        const fixture = await renderTree({ url: '/qits/', repositories: MIXED });
        const href = (label: string) =>
          links(fixture)
            .find((a) => a.textContent?.trim() === label)
            ?.getAttribute('href');

        expect(href('qits-ci-service')).toBe(`${PROJECTS_ORIGIN}/qits/qits-ci/qits-ci-service/`);
        expect(href('qits-eventstream')).toBe(`${PROJECTS_ORIGIN}/qits/libs/qits-eventstream/`);
      });

      it('opens a component address, with the children of the repository’s own archetype', async () => {
        const fixture = await renderTree({
          url: '/qits/qits-ci/qits-ci-service/',
          repositories: MIXED,
        });

        expect(current(fixture)).toEqual(['qits-ci-service']);
        // `services.details`, because that is what the repository IS — the slot vocabulary is about
        // kinds of repository, and the component it belongs to says nothing about that.
        const children = links(fixture).filter((a) =>
          a.classList.contains('qits-layout-link-child'),
        );
        expect(children.map((a) => a.textContent?.trim())).toEqual([
          'Project setup',
          'Workspaces',
          'Docs',
          'CI',
          'Artifacts',
          'Api Docs',
        ]);
      });

      /** A link made before the wrapper moved still resolves, and opens the row where it now sits. */
      it('opens the same repository from its archetype address', async () => {
        const fixture = await renderTree({
          url: '/qits/services/qits-ci-service/',
          repositories: MIXED,
        });

        expect(current(fixture)).toEqual(['qits-ci-service']);
        // Under the `qits-ci` heading all the same: where a row is drawn is the platform's answer,
        // not the address's.
        expect(headings(fixture)).toContain('qits-ci');
      });

      /** A component is enough to place a row; only a row with neither fact is left out. */
      it('draws a repository whose archetype it does not know, once it has a component', async () => {
        const fixture = await renderTree({
          url: '/qits/qits-ci/qits-ci-oci/',
          repositories: [
            { id: 'r1', name: 'qits-ci-oci', component: 'qits-ci', category: undefined },
            { id: 'r2', name: 'qits-qits', category: undefined },
          ],
        });

        expect(labels(fixture)).toContain('qits-ci-oci');
        expect(labels(fixture)).not.toContain('qits-qits');
        // No archetype, so no slot to hang children off — the row is the whole of it.
        expect(current(fixture)).toEqual(['qits-ci-oci']);
        expect(
          links(fixture).filter((a) => a.classList.contains('qits-layout-link-child')),
        ).toEqual(
          links(fixture).filter((a) =>
            ['Project setup', 'Workspaces'].includes(a.textContent?.trim() ?? ''),
          ),
        );
      });
    });

    it('says the repositories are still coming, rather than drawing no groups', async () => {
      const fixture = await renderTree({ url: '/qits/', pendingRepositories: true });
      expect(fixture.nativeElement.querySelector('.qits-layout-note')?.textContent).toContain(
        'Loading repositories',
      );
      expect(headings(fixture)).toEqual(['PLATFORM', 'SYSTEM']);
    });

    it('says the repository read failed, out loud', async () => {
      const fixture = await renderTree({
        url: '/qits/',
        repositories: [],
        repositoriesFailed: true,
      });
      const alert = fixture.nativeElement.querySelector('.qits-layout-alert') as HTMLElement;
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent).toContain('Could not load repositories');
    });

    /** PLATFORM is a group *about a project*, so it has nothing to say while none is open. */
    it('hides the project-scoped group where no project is in scope', async () => {
      expect(headings(await renderTree({ url: '/' }))).not.toContain('PLATFORM');
    });

    it('shows the project-scoped group once a project is', async () => {
      expect(headings(await renderTree({ url: '/qits/' }))).toContain('PLATFORM');
    });

    it('hangs the sub-menu under the row that is the page', async () => {
      const fixture = await renderTree({
        url: '/qits/services/qits-ci/runs/7',
        browserOrigin: CI_ORIGIN,
      });
      const templates = TestBed.createComponent(Templates);
      templates.detectChanges();
      TestBed.inject(QitsNavSubmenuSlot).register(templates.componentInstance.first());
      fixture.detectChanges();

      const items = [...fixture.nativeElement.querySelectorAll('.qits-layout-links > li')];
      const owner = items.find((li) => (li as HTMLElement).querySelector('.qits-layout-submenu'));
      expect((owner as HTMLElement).querySelector('.qits-layout-link')?.textContent?.trim()).toBe(
        'CI',
      );
      expect(fixture.nativeElement.querySelector('.qits-layout-submenu-detached')).toBeNull();
    });

    it('detaches the sub-menu where no row is the page', async () => {
      // A host that serves none of these applications: a bare `ng serve`, or one not flipped yet.
      const fixture = await renderTree({
        url: '/qits/services/qits-ci/',
        browserOrigin: 'https://nowhere.example.com',
      });
      const templates = TestBed.createComponent(Templates);
      templates.detectChanges();
      TestBed.inject(QitsNavSubmenuSlot).register(templates.componentInstance.first());
      fixture.detectChanges();

      expect(current(fixture)).toEqual([]);
      expect(fixture.nativeElement.querySelector('.qits-layout-submenu-detached')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.qits-layout-submenu')).toHaveLength(1);
    });

    /**
     * One application, two rows, one slot: qits-workspaces hangs both `Workspaces` and `Editor`
     * under the Project node, and the two differ only by the subpath the second one opens. The
     * platform keys an entry by slot and label, so this is a shape the edge now serves — and the
     * application alone can no longer name a row, nor a prefix match alone name the page.
     */
    describe('two entries of one application in one slot', () => {
      const WORKSPACES_ORIGIN = 'https://workspaces.dev.example.com';

      const TWO_ROWS: QitsNavigation = {
        ...TREE,
        slots: {
          ...TREE.slots,
          'project.detail': [
            {
              app: 'qits-workspaces',
              label: 'Workspaces',
              host: 'workspaces',
              path: '/workspaces',
              origin: WORKSPACES_ORIGIN,
              position: 1,
            },
            {
              app: 'qits-workspaces',
              label: 'Editor',
              host: 'workspaces',
              path: '/workspaces',
              origin: WORKSPACES_ORIGIN,
              position: 2,
              subpath: 'editor',
            },
          ],
        },
      };

      /** The reader is on the workspaces host, which is the one that serves both rows. */
      async function renderBoth(
        url: string,
        browserOrigin = WORKSPACES_ORIGIN,
      ): Promise<ComponentFixture<QitsMainLayout>> {
        TestBed.configureTestingModule({
          providers: [
            provideRouter([{ path: '**', component: Blank }]),
            provideLocationMocks(),
            provideQitsNavigationTree(TWO_ROWS),
            provideQitsProjectList(PROJECTS),
            provideQitsRepositoryList(REPOSITORIES, 'r9'),
            provideQitsScope('repository'),
            { provide: QITS_BROWSER_ORIGIN, useValue: browserOrigin },
          ],
        });
        await TestBed.inject(Router).navigateByUrl(url);
        const fixture = TestBed.createComponent(QitsMainLayout);
        fixture.detectChanges();
        return fixture;
      }

      function rows(fixture: ComponentFixture<unknown>): HTMLAnchorElement[] {
        return links(fixture).filter((a) =>
          ['Workspaces', 'Editor'].includes(a.textContent?.trim() ?? ''),
        );
      }

      it('draws both rows, in position order, each at its own address', async () => {
        const both = rows(await renderBoth('/qits/'));

        expect(both.map((a) => a.textContent?.trim())).toEqual(['Workspaces', 'Editor']);
        // The subpath is what the two hrefs differ by; without it they would be one destination.
        expect(both.map((a) => a.getAttribute('href'))).toEqual([
          `${WORKSPACES_ORIGIN}/qits/`,
          `${WORKSPACES_ORIGIN}/qits/editor`,
        ]);
      });

      /**
       * Two rows keyed by the application alone are one key to `@for … track`, and Angular says so
       * with NG0955 — on the *reconcile*, which is why this navigates rather than only rendering.
       * A duplicated key is not a cosmetic warning: it is what lets the list attribute one row's
       * DOM to the other across a re-render.
       */
      it('gives each row a key of its own, so neither is tracked as the other', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
          const fixture = await renderBoth('/qits/');
          await TestBed.inject(Router).navigateByUrl('/qits/editor');
          fixture.detectChanges();

          expect(rows(fixture).map((a) => a.textContent?.trim())).toEqual(['Workspaces', 'Editor']);
          expect(rows(fixture).map((a) => a.getAttribute('href'))).toEqual([
            `${WORKSPACES_ORIGIN}/qits/`,
            `${WORKSPACES_ORIGIN}/qits/editor`,
          ]);
          expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');
        } finally {
          warn.mockRestore();
        }
      });

      it('gives the page to the subpathed row, not to its subpath-less sibling', async () => {
        // `isCurrent` is a prefix test, so `Workspaces` matches here too — the deeper view wins.
        expect(current(await renderBoth('/qits/editor'))).toEqual(['Editor']);
      });

      it('leaves the subpath-less row the page on its own view', async () => {
        expect(current(await renderBoth('/qits/'))).toEqual(['Workspaces']);
      });

      it('hangs the sub-menu exactly once, under the row that is the page', async () => {
        const fixture = await renderBoth('/qits/editor');
        const templates = TestBed.createComponent(Templates);
        templates.detectChanges();
        TestBed.inject(QitsNavSubmenuSlot).register(templates.componentInstance.first());
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('.qits-layout-submenu')).toHaveLength(1);
        const items = [...fixture.nativeElement.querySelectorAll('.qits-layout-links > li')];
        const owner = items.find((li) => (li as HTMLElement).querySelector('.qits-layout-submenu'));
        expect((owner as HTMLElement).querySelector('.qits-layout-link')?.textContent?.trim()).toBe(
          'Editor',
        );
        expect(fixture.nativeElement.querySelector('.qits-layout-submenu-detached')).toBeNull();
      });
    });
  });

  /** Two templates, so the stack can be exercised without a second component. */
  @Component({
    template: `
      <ng-template #first><a class="spec-submenu-link" href="/ci/guide/">First</a></ng-template>
      <ng-template #second><span class="spec-second">Second</span></ng-template>
    `,
  })
  class Templates {
    readonly first = viewChild.required<TemplateRef<unknown>>('first');
    readonly second = viewChild.required<TemplateRef<unknown>>('second');
  }

  describe('the sub-menu slot', () => {
    function templates(): Templates {
      const fixture = TestBed.createComponent(Templates);
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    function submenu(fixture: ComponentFixture<unknown>, selector = '.qits-layout-submenu') {
      return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    }

    it('renders under the entry that is this application', () => {
      const fixture = render();
      TestBed.inject(QitsNavSubmenuSlot).register(templates().first());
      fixture.detectChanges();

      const items = [...fixture.nativeElement.querySelectorAll('.qits-layout-links > li')];
      expect(items[0].querySelector('.qits-layout-submenu')).not.toBeNull();
      expect(items[1].querySelector('.qits-layout-submenu')).toBeNull();
      expect(submenu(fixture, '.qits-layout-submenu-detached')).toBeNull();
      // The helper must not mistake a sub-menu anchor for a platform link.
      expect(links(fixture)).toHaveLength(3);
    });

    it('falls to the foot of the nav when no entry is this application', () => {
      // Nothing here matches jsdom's `/` base, which is also a bare `ng serve` or an app the
      // platform does not serve yet.
      const fixture = render([{ label: 'CI', href: '/ci/' }]);
      TestBed.inject(QitsNavSubmenuSlot).register(templates().first());
      fixture.detectChanges();

      expect(submenu(fixture, '.qits-layout-submenu-detached')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.qits-layout-submenu')).toHaveLength(1);
    });

    it('closes the mobile panel for a sub-menu link, but not for a click beside one', () => {
      const fixture = render();
      TestBed.inject(QitsNavSubmenuSlot).register(templates().first());
      fixture.detectChanges();

      burger(fixture).click();
      fixture.detectChanges();
      submenu(fixture)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      // A tree expands on clicks that are not links; collapsing the panel there would be hostile.
      expect(burger(fixture).getAttribute('aria-expanded')).toBe('true');

      fixture.nativeElement.addEventListener('click', (event: Event) => event.preventDefault());
      fixture.nativeElement
        .querySelector('.spec-submenu-link')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(burger(fixture).getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps the newest template when an older one is released', () => {
      const fixture = render();
      const slot = TestBed.inject(QitsNavSubmenuSlot);
      const both = templates();

      slot.register(both.first());
      slot.register(both.second());
      fixture.detectChanges();
      expect(submenu(fixture)?.textContent?.trim()).toBe('Second');

      // The order a router tears pages down in: the outgoing page goes *after* the incoming one
      // arrived. Releasing by identity is what stops it taking the live template with it.
      slot.release(both.first());
      fixture.detectChanges();
      expect(submenu(fixture)?.textContent?.trim()).toBe('Second');
    });
  });

  /**
   * The top-left slot. Not "does the picker work" — that is `QitsPicker`'s own spec — but the three
   * things this layout decides: *whether* the slot is a picker at all, that what it shows comes from
   * the scope rather than from anything held here, and that a pick is handed straight back to it.
   */
  describe('the project slot', () => {
    /** Somewhere for the router to land, so a URL can be asserted without a real page. */
    @Component({ template: '' })
    class Blank {}

    const PROJECTS: readonly QitsProject[] = [
      { id: 'p1', slug: 'one', name: 'One' },
      { id: 'p2', slug: 'two', name: 'Two' },
    ];

    function renderProjects(
      projects: readonly QitsProject[] = PROJECTS,
      options?: { readonly failed?: boolean },
    ): ComponentFixture<QitsMainLayout> {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', component: Blank }]),
          provideLocationMocks(),
          provideQitsNavigationLinks(PLATFORM),
          provideQitsProjectList(projects, options),
          provideQitsScope('project'),
        ],
      });
      const fixture = TestBed.createComponent(QitsMainLayout);
      fixture.detectChanges();
      return fixture;
    }

    /** `select` navigates without handing the promise back, so the navigation is drained here. */
    async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
      for (let round = 0; round < 4; round += 1) {
        await Promise.resolve();
        await fixture.whenStable();
      }
      fixture.detectChanges();
    }

    function optionRows(fixture: ComponentFixture<unknown>): HTMLElement[] {
      return [...fixture.nativeElement.querySelectorAll('.qits-picker-option')] as HTMLElement[];
    }

    function pill(fixture: ComponentFixture<unknown>): string | null {
      return fixture.nativeElement.querySelector('.qits-picker-value')?.textContent?.trim() ?? null;
    }

    it('keeps the wordmark for an application that provides no projects', () => {
      const fixture = render();
      expect(fixture.nativeElement.querySelector('.qits-layout-brand')?.textContent).toBe('qits');
      expect(fixture.nativeElement.querySelector('qits-picker')).toBeNull();
    });

    it('replaces the wordmark with the picker once projects are provided', () => {
      const fixture = renderProjects();

      expect(fixture.nativeElement.querySelector('.qits-layout-brand')).toBeNull();
      expect(optionRows(fixture).map((row) => row.textContent?.trim())).toEqual(['One', 'Two']);
      // The nav is still named after the brand: the wordmark left the screen, not the app's name.
      expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
        'qits navigation',
      );
    });

    /**
     * A list with no scope is a control that can neither say what is open nor act on a pick. The
     * wordmark is a better thing to put in the most prominent place in the chrome than a dead one.
     */
    it('keeps the wordmark when there is a list but nothing to say which is current', () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideQitsNavigationLinks(PLATFORM),
          {
            provide: QITS_PROJECTS,
            useValue: { projects: signal(PROJECTS), failed: signal(false) },
          },
        ],
      });
      const fixture = TestBed.createComponent(QitsMainLayout);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.qits-layout-brand')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('qits-picker')).toBeNull();
    });

    it('says it is loading until the source answers, rather than showing an empty picker', () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideQitsNavigationLinks(PLATFORM),
          {
            provide: QITS_PROJECTS,
            useValue: {
              projects: signal<readonly QitsProject[] | undefined>(undefined),
              failed: signal(false),
            },
          },
          provideQitsScope('project'),
        ],
      });
      const fixture = TestBed.createComponent(QitsMainLayout);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.qits-layout-project-note')?.textContent,
      ).toContain('Loading projects');
      expect(fixture.nativeElement.querySelector('qits-picker')).toBeNull();
    });

    /** An empty list and a failed read are different facts, and a reader is told which one it is. */
    it('says the read failed, rather than drawing it as a platform with no projects', () => {
      const fixture = renderProjects([], { failed: true });

      const note = fixture.nativeElement.querySelector('.qits-layout-project-error') as HTMLElement;
      expect(note.textContent).toContain('Could not load projects');
      expect(note.getAttribute('role')).toBe('alert');
    });

    it('shows the project the address names, with nothing chosen by default', async () => {
      const fixture = renderProjects();
      expect(pill(fixture)).toBeNull();

      await TestBed.inject(Router).navigateByUrl('/two/');
      fixture.detectChanges();

      expect(pill(fixture)).toBe('Two');
    });

    /** A pick is a navigation: the project is the first segment, so picking one goes there. */
    it('hands a pick to the scope, which takes the reader to the project', async () => {
      const fixture = renderProjects();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/runs/7');
      fixture.detectChanges();

      optionRows(fixture)[0].click();
      await settle(fixture);

      // No trailing slash: `/one/` would parse as a second, empty segment and match no `:project`.
      expect(router.url).toBe('/one');
      expect(pill(fixture)).toBe('One');
    });

    it('goes back to the root of this host when the pick is cleared', async () => {
      const fixture = renderProjects();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/two/');
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.qits-picker-clear').click();
      await settle(fixture);

      expect(router.url).toBe('/');
      expect(pill(fixture)).toBeNull();
    });

    /** No option, no label — so the choices come back rather than a pill the picker cannot draw. */
    it('shows the options again for an address naming a project the list does not contain', async () => {
      const fixture = renderProjects();

      await TestBed.inject(Router).navigateByUrl('/gone/services/qits-ci/');
      fixture.detectChanges();

      expect(pill(fixture)).toBeNull();
      expect(optionRows(fixture)).toHaveLength(2);
    });

    it('closes the mobile panel behind a pick, which is a navigation', async () => {
      const fixture = renderProjects();
      burger(fixture).click();
      fixture.detectChanges();

      optionRows(fixture)[1].click();
      await settle(fixture);

      expect(burger(fixture).getAttribute('aria-expanded')).toBe('false');
    });
  });
});
