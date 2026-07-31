import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QITS_NAV_LINKS, QitsMainLayout } from './main-layout';

describe('QitsMainLayout', () => {
  function render(): ComponentFixture<QitsMainLayout> {
    // The layout hosts a `<router-outlet />`, so it needs a router even with nothing to route to.
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(QitsMainLayout);
    fixture.detectChanges();
    return fixture;
  }

  function burger(fixture: ComponentFixture<unknown>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.qits-layout-burger') as HTMLButtonElement;
  }

  function links(fixture: ComponentFixture<unknown>): HTMLAnchorElement[] {
    return [...fixture.nativeElement.querySelectorAll('.qits-layout-link')] as HTMLAnchorElement[];
  }

  it('renders every platform SPA as a plain href, not a route', () => {
    const anchors = links(render());
    expect(anchors.map((a) => a.textContent?.trim())).toEqual([
      'Home',
      'CI',
      'Artifacts',
      'Projects',
      'Workspaces',
      'Observability',
    ]);
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(
      QITS_NAV_LINKS.map((link) => link.href),
    );
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

  it('takes the link list as an input, so an app can override it', () => {
    const fixture = render();
    fixture.componentRef.setInput('links', [{ label: 'Docs', href: '/docs/' }]);
    fixture.detectChanges();
    expect(links(fixture).map((a) => a.textContent?.trim())).toEqual(['Docs']);
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
});
