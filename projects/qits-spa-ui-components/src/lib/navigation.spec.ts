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
  provideQitsNavigationTree,
  QITS_NAVIGATION,
  QITS_NAVIGATION_URL,
  toNavTree,
  type QitsNavigation,
  type QitsNavigationSource,
} from './navigation';

describe('toNavTree', () => {
  it('flattens every slot, tags each entry with it, and sorts by position then label', () => {
    const tree = toNavTree({
      environment: 'dev',
      origin: 'https://dev.example.com',
      slots: {
        system: [
          {
            app: 'qits-platform-system',
            label: 'System',
            host: 'system',
            origin: 'https://system.dev.example.com',
            position: 4,
          },
          {
            app: 'qits-projects',
            label: 'Overview',
            host: 'projects',
            origin: 'https://projects.dev.example.com',
            position: 1,
          },
        ],
        'services.details': [
          {
            app: 'qits-ci',
            label: 'CI',
            host: 'ci',
            origin: 'https://ci.dev.example.com',
            position: 2,
          },
          {
            app: 'qits-docs',
            label: 'Docs',
            host: 'docs',
            origin: 'https://docs.dev.example.com',
            position: 2,
          },
        ],
      },
    });

    expect(tree.environmentOrigin).toBe('https://dev.example.com');
    // Slots sort together: each group reads them back with `entries(slot)`, and one order is enough.
    expect(tree.entries.map((entry) => [entry.slot, entry.label, entry.position])).toEqual([
      ['system', 'Overview', 1],
      ['services.details', 'CI', 2],
      ['services.details', 'Docs', 2],
      ['system', 'System', 4],
    ]);
    // Slots served means the flat shape is gone, not empty: the sidebar draws the tree.
    expect(tree.legacy).toBeUndefined();
  });

  it('carries a host-less application as such, with the environment origin', () => {
    const tree = toNavTree({
      origin: 'https://dev.example.com',
      slots: {
        system: [
          {
            app: 'qits-ci',
            label: 'CI',
            host: null,
            origin: 'https://dev.example.com',
            position: 2,
          },
        ],
      },
    });
    expect(tree.entries[0].host).toBeNull();
    expect(tree.entries[0].origin).toBe('https://dev.example.com');
  });

  it('ignores a slot it does not know and an entry it could not draw', () => {
    const tree = toNavTree({
      slots: {
        system: [
          {
            app: 'qits-ci',
            label: '',
            host: 'ci',
            origin: 'https://ci.dev.example.com',
            position: 1,
          },
          { app: 'qits-docs', label: 'Docs', host: 'docs', origin: '', position: 1 },
        ],
        // A slot this release does not know: dropped, not drawn somewhere arbitrary.
        nowhere: [
          {
            app: 'qits-x',
            label: 'X',
            host: 'x',
            origin: 'https://x.dev.example.com',
            position: 1,
          },
        ],
      },
    } as QitsNavigation);
    expect(tree.entries).toEqual([]);
  });

  it('reads the flat shape as legacy, which is what an old edge answers', () => {
    const tree = toNavTree({ links: [{ label: 'CI', href: '/ci/' }] });
    expect(tree.entries).toEqual([]);
    expect(tree.legacy).toEqual([{ label: 'CI', href: '/ci/' }]);
  });

  it('reads no answer at all as the stranded legacy shape', () => {
    expect(toNavTree(undefined)).toEqual({
      entries: [],
      environmentOrigin: undefined,
      legacy: [],
    });
  });
});

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

  it('asks the edge at an absolute path, not one relative to the SPA', () => {
    source(provideQitsNavigation());
    expect(QITS_NAVIGATION_URL).toBe('/main-navigation');
    http().expectOne(QITS_NAVIGATION_URL);
  });

  it('has no tree until the answer arrives, and then the normalised one', () => {
    const navigation = source(provideQitsNavigation());
    expect(navigation.tree()).toBeUndefined();
    expect(navigation.failed()).toBe(false);

    http()
      .expectOne(QITS_NAVIGATION_URL)
      .flush({
        origin: 'https://dev.example.com',
        slots: {
          system: [
            {
              app: 'qits-projects',
              label: 'Overview',
              host: 'projects',
              origin: 'https://projects.dev.example.com',
              position: 1,
            },
          ],
        },
        // The flat list rides along for one release; slots being present is what retires it.
        links: [{ label: 'Home', href: '/' }],
      });

    expect(navigation.tree()?.entries.map((entry) => entry.label)).toEqual(['Overview']);
    expect(navigation.tree()?.legacy).toBeUndefined();
    expect(navigation.failed()).toBe(false);
  });

  it('asks once, not once per read', () => {
    const navigation = source(provideQitsNavigation());
    navigation.tree();
    navigation.tree();
    // One request for the life of the application: the chrome does not change under a reader.
    http().expectOne(QITS_NAVIGATION_URL);
    http().verify();
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

    expect(navigation.tree()?.entries).toEqual([]);
    expect(navigation.tree()?.legacy).toEqual([]);
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

describe('the literal sources', () => {
  it('answer a whole payload from the moment they exist, with nothing to flush', () => {
    // No HttpClient at all: the literal source is the reason a spec about the layout need not know
    // the navigation is fetched anywhere.
    TestBed.configureTestingModule({
      providers: [
        provideQitsNavigationTree({
          origin: 'https://dev.example.com',
          slots: {
            platform: [
              {
                app: 'qits-platform-events',
                label: 'Events',
                host: 'events',
                origin: 'https://events.dev.example.com',
                position: 1,
              },
            ],
          },
        }),
      ],
    });
    const navigation = TestBed.inject(QITS_NAVIGATION);

    expect(navigation.tree()?.entries.map((entry) => entry.slot)).toEqual(['platform']);
    expect(navigation.failed()).toBe(false);
  });

  it('answer the flat shape too, which is what a story of the old chrome needs', () => {
    TestBed.configureTestingModule({
      providers: [provideQitsNavigationLinks([{ label: 'Home', href: '/' }])],
    });
    expect(TestBed.inject(QITS_NAVIGATION).tree()?.legacy).toEqual([{ label: 'Home', href: '/' }]);
  });

  it('pass an empty list straight through, which is the stranded state', () => {
    TestBed.configureTestingModule({ providers: [provideQitsNavigationLinks([])] });
    expect(TestBed.inject(QITS_NAVIGATION).tree()?.legacy).toEqual([]);
  });
});
