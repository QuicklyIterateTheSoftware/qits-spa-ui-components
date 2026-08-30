import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PRIMARY_OUTLET, provideRouter, Router } from '@angular/router';

import { QITS_BROWSER_ORIGIN } from './app-links';
import { provideQitsNavigationTree } from './navigation';
import { provideQitsProjectList } from './projects';
import { provideQitsRepositoryList, type QitsRepository } from './repositories';
import {
  parseScope,
  provideQitsScope,
  QITS_CATEGORIES,
  QITS_SCOPE,
  scopeCommands,
  scopeGroup,
  scopePath,
  type QitsRouting,
} from './scope';

describe('parseScope', () => {
  const KNOWN = new Set(['qits', 'payments']);
  const COMPONENTS = new Set(['qits-ci', 'qits-projects']);

  it('reads a repository out of the path, whatever follows it', () => {
    expect(parseScope('/qits/services/qits-ci/runs/1')).toEqual({
      project: 'qits',
      group: 'services',
      category: 'services',
      repository: 'qits-ci',
    });
  });

  /** The category in segment two is the proof: no project list has to have answered yet. */
  it('needs no known slug when segment two is a category', () => {
    expect(parseScope('/anything/libs/qits-eventstream/')).toEqual({
      project: 'anything',
      group: 'libs',
      category: 'libs',
      repository: 'qits-eventstream',
    });
  });

  /** A component is an open set, so the list the chrome loaded is what proves this segment. */
  it('reads the component form once the components are known', () => {
    expect(parseScope('/qits/qits-ci/qits-ci-service/runs/1', KNOWN, COMPONENTS)).toEqual({
      project: 'qits',
      group: 'qits-ci',
      repository: 'qits-ci-service',
    });
    // No category: the segment is a component, and nothing about the archetype is in the address.
    expect(parseScope('/qits/qits-ci/qits-ci-service', KNOWN, COMPONENTS).category).toBeUndefined();
  });

  it('reads a component with no repository under it as the project it is in', () => {
    expect(parseScope('/qits/qits-ci', KNOWN, COMPONENTS)).toEqual({
      project: 'qits',
      group: 'qits-ci',
    });
  });

  /** Until the repository list answers there is nothing to prove the segment with. */
  it('settles the component form on the project alone until the components are known', () => {
    expect(parseScope('/qits/qits-ci/qits-ci-service', KNOWN)).toEqual({ project: 'qits' });
    // …and the project it names never changes when they arrive.
    expect(parseScope('/qits/qits-ci/qits-ci-service', KNOWN, COMPONENTS).project).toBe('qits');
  });

  /** A component of some project is no proof that segment one is a project at all. */
  it('never reads a component form under a slug the platform does not have', () => {
    expect(parseScope('/traces/qits-ci/qits-ci-service', KNOWN, COMPONENTS)).toEqual({});
  });

  it('keeps an app page inside a project unscoped below the project', () => {
    expect(parseScope('/qits/epics/1', KNOWN, COMPONENTS)).toEqual({ project: 'qits' });
  });

  it('leaves an application page unscoped rather than reading it as a project', () => {
    expect(parseScope('/traces')).toEqual({});
    expect(parseScope('/runs/7')).toEqual({});
    expect(parseScope('/')).toEqual({});
    expect(parseScope('')).toEqual({});
  });

  it('reads the project form only for a slug the platform actually has', () => {
    expect(parseScope('/qits/epics/x', KNOWN)).toEqual({ project: 'qits' });
    expect(parseScope('/traces/x', KNOWN)).toEqual({});
  });

  /** A project is never a category, so an app's own `/services` page keeps working. */
  it('never reads a category as a project', () => {
    for (const category of QITS_CATEGORIES) {
      expect(parseScope(`/${category}/anything`, new Set([category]))).toEqual({});
    }
  });

  it('reads a category with no repository under it as the project it is in', () => {
    expect(parseScope('/qits/services')).toEqual({
      project: 'qits',
      group: 'services',
      category: 'services',
    });
  });

  it('stops at the query and the fragment', () => {
    expect(parseScope('/qits/services/qits-ci?tab=log#l3')).toEqual({
      project: 'qits',
      group: 'services',
      category: 'services',
      repository: 'qits-ci',
    });
  });
});

describe('scopePath and scopeCommands', () => {
  it('spell the three shapes of address', () => {
    expect(scopePath({})).toBe('/');
    expect(scopePath({ project: 'qits' })).toBe('/qits/');
    expect(scopePath({ project: 'qits', group: 'qits-ci', repository: 'qits-ci-service' })).toBe(
      '/qits/qits-ci/qits-ci-service/',
    );
    // A group with nothing under it is not an address: the project is the honest base.
    expect(scopePath({ project: 'qits', group: 'qits-ci' })).toBe('/qits/');
    expect(scopePath(undefined)).toBe('/');
  });

  /** A caller that spelled the archetype form before components existed keeps spelling it. */
  it('spell the category a caller wrote where no group was given', () => {
    expect(scopePath({ project: 'qits', category: 'services', repository: 'qits-ci' })).toBe(
      '/qits/services/qits-ci/',
    );
    expect(scopePath({ project: 'qits', category: 'services' })).toBe('/qits/');
  });

  it('give the same prefix as router commands', () => {
    expect(scopeCommands({})).toEqual(['/']);
    expect(scopeCommands({ project: 'qits' })).toEqual(['/', 'qits']);
    expect(
      scopeCommands({ project: 'qits', group: 'qits-eventstream', repository: 'qits-eventstream' }),
    ).toEqual(['/', 'qits', 'qits-eventstream', 'qits-eventstream']);
    expect(
      scopeCommands({ project: 'qits', category: 'libs', repository: 'qits-eventstream' }),
    ).toEqual(['/', 'qits', 'libs', 'qits-eventstream']);
  });
});

describe('scopeGroup', () => {
  it('is the one middle segment, whichever field named it', () => {
    expect(scopeGroup({ project: 'qits', group: 'qits-ci' })).toBe('qits-ci');
    expect(scopeGroup({ project: 'qits', category: 'services' })).toBe('services');
    // The group wins: a scope the parser produced states both for an address in the archetype form.
    expect(scopeGroup({ project: 'qits', group: 'services', category: 'services' })).toBe(
      'services',
    );
    expect(scopeGroup({})).toBeUndefined();
    expect(scopeGroup(undefined)).toBeUndefined();
  });
});

describe('UrlScope', () => {
  @Component({ template: '' })
  class Blank {}

  /** `select` navigates without handing the promise back, so the navigation is drained here. */
  async function settle(): Promise<void> {
    for (let round = 0; round < 4; round += 1) {
      await Promise.resolve();
      await TestBed.inject(ApplicationRef).whenStable();
    }
  }

  /** What the router's own serialiser makes of an address — the thing route matching sees. */
  function segments(router: Router): string[] {
    const primary = router.parseUrl(router.url).root.children[PRIMARY_OUTLET];
    return (primary?.segments ?? []).map((segment) => segment.path);
  }

  const NAVIGATION = {
    origin: 'https://dev.example.com',
    slots: {
      system: [
        {
          app: 'qits-projects',
          label: 'Overview',
          host: 'projects',
          path: '/projects',
          origin: 'https://projects.dev.example.com',
          position: 1,
        },
      ],
    },
  };

  /** A document that records where it was sent, so a jump between hosts can be asserted. */
  function documentStub(): {
    location: { origin: string; assign: (href: string) => void; pathname: string };
    assigned: string[];
  } {
    const assigned: string[] = [];
    return {
      location: {
        origin: 'https://system.dev.example.com',
        pathname: '/',
        assign: (href: string) => assigned.push(href),
      },
      assigned,
    };
  }

  function configure(
    routing: QitsRouting,
    doc = documentStub(),
    repositories: readonly QitsRepository[] = [{ id: 'r1', name: 'qits-ci', category: 'services' }],
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        provideLocationMocks(),
        provideQitsNavigationTree(NAVIGATION),
        provideQitsProjectList([{ id: 'p1', slug: 'qits', name: 'qits' }]),
        provideQitsRepositoryList(repositories),
        { provide: DOCUMENT, useValue: doc },
        { provide: QITS_BROWSER_ORIGIN, useValue: doc.location.origin },
        provideQitsScope(routing),
      ],
    });
    return doc;
  }

  it('reads the address, and follows it', async () => {
    configure('repository');
    const scope = TestBed.inject(QITS_SCOPE);
    const router = TestBed.inject(Router);
    expect(scope.scope()).toEqual({});

    await router.navigateByUrl('/qits/services/qits-ci/runs/1');
    expect(scope.scope()).toEqual({
      project: 'qits',
      group: 'services',
      category: 'services',
      repository: 'qits-ci',
    });
    expect(scope.routing).toBe('repository');
  });

  /** The components come from the project's own repositories, which is what proves the segment. */
  it('reads the component form from the components its repositories carry', async () => {
    configure('repository', documentStub(), [
      { id: 'r1', name: 'qits-ci-service', component: 'qits-ci', category: 'services' },
    ]);
    const scope = TestBed.inject(QITS_SCOPE);

    await TestBed.inject(Router).navigateByUrl('/qits/qits-ci/qits-ci-service/runs/1');

    expect(scope.scope()).toEqual({
      project: 'qits',
      group: 'qits-ci',
      repository: 'qits-ci-service',
    });
    expect(scope.repositoryId()).toBe('r1');
  });

  /** Both forms address the same repository: a link made before the wrapper moved still resolves. */
  it('resolves the archetype form of a repository that has a component too', async () => {
    configure('repository', documentStub(), [
      { id: 'r1', name: 'qits-ci-service', component: 'qits-ci', category: 'services' },
    ]);
    const scope = TestBed.inject(QITS_SCOPE);

    await TestBed.inject(Router).navigateByUrl('/qits/services/qits-ci-service/');

    expect(scopeGroup(scope.scope())).toBe('services');
    expect(scope.repositoryId()).toBe('r1');
  });

  it('resolves the slug to an id, and the repository name to its id', async () => {
    configure('repository');
    const scope = TestBed.inject(QITS_SCOPE);
    await TestBed.inject(Router).navigateByUrl('/qits/services/qits-ci/');

    expect(scope.projectId()).toBe('p1');
    expect(scope.repositoryId()).toBe('r1');
  });

  /** The project form needs the list: until it answers, `/qits/epics/1` is this app's own page. */
  it('reads the project form once the project list names the slug', async () => {
    configure('project');
    const scope = TestBed.inject(QITS_SCOPE);
    await TestBed.inject(Router).navigateByUrl('/qits/epics/1');
    expect(scope.scope()).toEqual({ project: 'qits' });

    await TestBed.inject(Router).navigateByUrl('/elsewhere/epics/1');
    expect(scope.scope()).toEqual({});
    expect(scope.projectId()).toBeUndefined();
  });

  it('picks a project on this host where the app has a project route', async () => {
    const doc = configure('project');
    const scope = TestBed.inject(QITS_SCOPE);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/somewhere');

    scope.select('qits');
    await settle();

    expect(router.url).toBe('/qits');
    // ONE segment. `/qits/` parses as `qits` plus an empty one, which matches no `:project` route
    // and lands every pick on the application's `**` instead.
    expect(segments(router)).toEqual(['qits']);
    expect(scope.scope()).toEqual({ project: 'qits' });
    // It stayed: this application serves the project itself.
    expect(doc.assigned).toEqual([]);
  });

  it('clears the pick back to the root of this host', async () => {
    configure('repository');
    const scope = TestBed.inject(QITS_SCOPE);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/qits/services/qits-ci/');

    scope.select(undefined);
    await settle();

    expect(router.url).toBe('/');
    expect(segments(router)).toEqual([]);
    expect(scope.scope()).toEqual({});
  });

  /**
   * A system app is about the platform, not about a project, so `/qits/` is not an address it
   * serves. The pick has to leave for qits-projects rather than land on a 404.
   */
  it('leaves for the projects host from an application with no project route', async () => {
    const doc = configure('system');
    const scope = TestBed.inject(QITS_SCOPE);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/swarm/nodes');

    scope.select('qits');

    expect(doc.assigned).toEqual(['https://projects.dev.example.com/qits/']);
    // It left: this application's own address is untouched.
    expect(router.url).toBe('/swarm/nodes');
  });
});
