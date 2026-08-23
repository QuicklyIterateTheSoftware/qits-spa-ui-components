import { provideLocationMocks } from '@angular/common/testing';
import { Component, signal, viewChild, type TemplateRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { QitsMainLayout } from './main-layout';
import { QitsNavSubmenuSlot } from './nav-submenu';
import { provideQitsNavigationLinks, QITS_NAVIGATION, type QitsNavLink } from './navigation';
import { QITS_PROJECT_SCOPE, QueryParamProjectScope } from './project-scope';
import { provideQitsProjectList, QITS_PROJECTS, type QitsProject } from './projects';

describe('QitsMainLayout', () => {
  const PLATFORM: readonly QitsNavLink[] = [
    { label: 'Home', href: '/' },
    { label: 'CI', href: '/ci/' },
    { label: 'Docs', href: '/platform-docs/' },
  ];

  /**
   * The layout hosts a `<router-outlet />`, so it needs a router even with nothing to route to.
   * The literal source stands in for the gateway: nothing is fetched, so there is no request to
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

  it('renders what the navigation source gives it, as plain hrefs', () => {
    const anchors = links(render());
    expect(anchors.map((a) => a.textContent?.trim())).toEqual(['Home', 'CI', 'Docs']);
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(PLATFORM.map((link) => link.href));
    // routerLink would compile and go nowhere: these destinations are other applications.
    expect(anchors.some((a) => a.hasAttribute('ng-reflect-router-link'))).toBe(false);
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

  it('lets a non-empty [links] beat the source outright', () => {
    const fixture = render();
    fixture.componentRef.setInput('links', [{ label: 'Docs', href: '/docs/' }]);
    fixture.detectChanges();
    expect(links(fixture).map((a) => a.textContent?.trim())).toEqual(['Docs']);

    // Empty is the default, not an override: the source comes back rather than the nav emptying.
    fixture.componentRef.setInput('links', []);
    fixture.detectChanges();
    expect(links(fixture).map((a) => a.textContent?.trim())).toEqual(['Home', 'CI', 'Docs']);
  });

  it('renders nothing and says it is busy until the source answers', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: QITS_NAVIGATION,
          useValue: { links: signal(undefined), failed: signal(false) },
        },
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
    // `/` is the gateway's own root, not a registry entry, so this fallback cannot go stale.
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

  it('marks the link matching the document base as the current page, and only that one', () => {
    const fixture = render();
    // jsdom serves the specs from the site root, so Home is the app we are in.
    const current = links(fixture).filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Home']);
    expect(current[0].classList).toContain('qits-layout-link-current');
    expect(links(fixture)[1].getAttribute('aria-current')).toBeNull();
  });

  it('mounts the outlet the child routes render into', () => {
    const fixture = render();
    const content = fixture.nativeElement.querySelector('main.qits-layout-content') as HTMLElement;
    expect(content.querySelector('router-outlet')).not.toBeNull();
  });

  describe('the sub-menu slot', () => {
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
      // gateway does not route yet.
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
      { id: 'p1', name: 'One' },
      { id: 'p2', name: 'Two' },
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
          { provide: QITS_PROJECT_SCOPE, useClass: QueryParamProjectScope },
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

    it('shows the project the scope reports, with nothing chosen by default', async () => {
      const fixture = renderProjects();
      expect(pill(fixture)).toBeNull();

      await TestBed.inject(Router).navigate([], { queryParams: { project: 'p2' } });
      fixture.detectChanges();

      expect(pill(fixture)).toBe('Two');
    });

    /** The default scope rewrites one parameter and keeps the page: a pick is not also a departure. */
    it('hands a pick to the scope, which lands in the URL beside the path', async () => {
      const fixture = renderProjects();
      const router = TestBed.inject(Router);
      await router.navigate(['/runs/7']);
      fixture.detectChanges();

      optionRows(fixture)[0].click();
      await settle(fixture);

      expect(router.url).toBe('/runs/7?project=p1');
      expect(pill(fixture)).toBe('One');
    });

    it('drops the parameter again when the pick is cleared', async () => {
      const fixture = renderProjects();
      const router = TestBed.inject(Router);
      await router.navigate(['/runs/7'], { queryParams: { project: 'p1', tab: 'log' } });
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.qits-picker-clear').click();
      await settle(fixture);

      // Only this parameter: the rest of the address is not the picker's to edit.
      expect(router.url).toBe('/runs/7?tab=log');
      expect(pill(fixture)).toBeNull();
    });

    /** No option, no label — so the choices come back rather than a pill the picker cannot draw. */
    it('shows the options again for a scope naming a project the list does not contain', async () => {
      const fixture = renderProjects();

      await TestBed.inject(Router).navigate([], { queryParams: { project: 'gone' } });
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
