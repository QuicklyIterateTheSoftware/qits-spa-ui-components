import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideQitsNavigation,
  provideQitsNavigationLinks,
  QITS_NAVIGATION,
  QITS_NAVIGATION_URL,
  type QitsNavigationSource,
} from './navigation';

describe('provideQitsNavigation', () => {
  function source(...providers: unknown[]): QitsNavigationSource {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...(providers as never[])],
    });
    return TestBed.inject(QITS_NAVIGATION);
  }

  function http(): HttpTestingController {
    return TestBed.inject(HttpTestingController);
  }

  it('asks the gateway at an absolute path, not one relative to the SPA', () => {
    source(provideQitsNavigation());
    expect(QITS_NAVIGATION_URL).toBe('/main-navigation');
    http().expectOne(QITS_NAVIGATION_URL);
  });

  it('has no links until the answer arrives, and then exactly those', () => {
    const navigation = source(provideQitsNavigation());
    expect(navigation.links()).toBeUndefined();
    expect(navigation.failed()).toBe(false);

    http()
      .expectOne(QITS_NAVIGATION_URL)
      .flush({
        links: [
          { label: 'Home', href: '/' },
          { label: 'CI', href: '/ci/' },
        ],
      });

    expect(navigation.links()).toEqual([
      { label: 'Home', href: '/' },
      { label: 'CI', href: '/ci/' },
    ]);
    expect(navigation.failed()).toBe(false);
  });

  it('asks once, not once per read', () => {
    const navigation = source(provideQitsNavigation());
    navigation.links();
    navigation.links();
    // One request for the life of the application: the chrome does not change under a reader.
    http().expectOne(QITS_NAVIGATION_URL);
    http().verify();
  });

  it('reads an unfamiliar body for its links and ignores the rest', () => {
    const navigation = source(provideQitsNavigation());
    // The object wrapper is what lets the gateway add fields without breaking a released SPA.
    http()
      .expectOne(QITS_NAVIGATION_URL)
      .flush({ links: [{ label: 'CI', href: '/ci/' }], revision: 7 });
    expect(navigation.links()).toEqual([{ label: 'CI', href: '/ci/' }]);
  });

  it('takes a url, for a fixture or a platform behind a proxy', () => {
    source(provideQitsNavigation({ url: '/elsewhere/main-navigation' }));
    http().expectOne('/elsewhere/main-navigation');
  });

  it('gives up empty rather than throwing: a failed navigation is not a failed app', () => {
    const navigation = source(provideQitsNavigation());
    http()
      .expectOne(QITS_NAVIGATION_URL)
      .error(new ProgressEvent('error'), { status: 502, statusText: 'Bad Gateway' });

    expect(navigation.links()).toEqual([]);
    expect(navigation.failed()).toBe(true);
  });

  it('unsubscribes when the injector that made it goes away', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const child = createEnvironmentInjector(
      [provideQitsNavigation()],
      TestBed.inject(EnvironmentInjector),
    );
    runInInjectionContext(child, () => inject(QITS_NAVIGATION));

    const request = http().expectOne(QITS_NAVIGATION_URL);
    expect(request.cancelled).toBe(false);
    child.destroy();
    expect(request.cancelled).toBe(true);
  });
});

describe('provideQitsNavigationLinks', () => {
  it('is answered from the moment it exists, with nothing to flush', () => {
    // No HttpClient at all: the literal source is the reason a spec about the layout need not know
    // the navigation is fetched anywhere.
    TestBed.configureTestingModule({
      providers: [provideQitsNavigationLinks([{ label: 'Home', href: '/' }])],
    });
    const navigation = TestBed.inject(QITS_NAVIGATION);

    expect(navigation.links()).toEqual([{ label: 'Home', href: '/' }]);
    expect(navigation.failed()).toBe(false);
  });

  it('passes an empty list straight through, which is the stranded state', () => {
    TestBed.configureTestingModule({ providers: [provideQitsNavigationLinks([])] });
    expect(TestBed.inject(QITS_NAVIGATION).links()).toEqual([]);
  });
});
