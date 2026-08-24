import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { QitsAppLinks, QITS_BROWSER_ORIGIN } from './app-links';
import { provideQitsNavigationTree, type QitsNavEntry } from './navigation';

describe('QitsAppLinks', () => {
  @Component({ template: '' })
  class Blank {}

  const NAVIGATION = {
    environment: 'dev',
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
          position: 1,
        },
        // Not flipped yet: no host of its own, and the environment origin instead.
        {
          app: 'qits-artifacts',
          label: 'Artifacts',
          host: null,
          origin: 'https://dev.example.com',
          position: 3,
        },
      ],
    },
  };

  function links(browserOrigin = 'https://ci.dev.example.com'): QitsAppLinks {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        provideLocationMocks(),
        provideQitsNavigationTree(NAVIGATION),
        { provide: QITS_BROWSER_ORIGIN, useValue: browserOrigin },
      ],
    });
    return TestBed.inject(QitsAppLinks);
  }

  /** An entry as the platform served it — read back from the same source the sidebar reads. */
  function entry(appLinks: QitsAppLinks, app: string): QitsNavEntry {
    const found = appLinks.entries('services.details').find((row) => row.app === app);
    if (!found) throw new Error(`no entry for ${app}`);
    return found;
  }

  it('gives an application its own origin, and nothing for one without a host', () => {
    const appLinks = links();
    expect(appLinks.origin('qits-ci')).toBe('https://ci.dev.example.com');
    expect(appLinks.origin('qits-artifacts')).toBeUndefined();
    expect(appLinks.origin('qits-nothing')).toBeUndefined();
    expect(appLinks.environmentOrigin()).toBe('https://dev.example.com');
  });

  it('reads a slot in the order the platform sorted it', () => {
    const appLinks = links();
    expect(appLinks.entries('services.details').map((row) => row.label)).toEqual([
      'Docs',
      'CI',
      'Artifacts',
    ]);
    expect(appLinks.entries('platform')).toEqual([]);
  });

  it('builds a link out of the origin, the scope and the path', () => {
    const appLinks = links();
    expect(
      appLinks.href('qits-ci', '', {
        project: 'qits',
        category: 'services',
        repository: 'qits-ci',
      }),
    ).toBe('https://ci.dev.example.com/qits/services/qits-ci/');
    expect(appLinks.href('qits-ci', 'runs/7', { project: 'qits' })).toBe(
      'https://ci.dev.example.com/qits/runs/7',
    );
    expect(appLinks.href('qits-ci', '')).toBe('https://ci.dev.example.com/');
  });

  /**
   * An application the platform does not serve on a host of its own is still at its old segment
   * under the environment origin — and has no scoped address, so the scope is dropped rather than
   * spelled into a URL that would 404.
   */
  it('falls back to the old path segment for an application with no host', () => {
    const appLinks = links();
    expect(appLinks.href('qits-artifacts', 'images', { project: 'qits' }, '/artifacts/')).toBe(
      'https://dev.example.com/artifacts/images',
    );
    // No fallback offered: there is no address this library can honestly spell.
    expect(appLinks.href('qits-artifacts', '', { project: 'qits' })).toBeUndefined();
    expect(appLinks.href('qits-nothing', '')).toBeUndefined();
  });

  it('is current on its own host, inside the scope on screen', async () => {
    const appLinks = links('https://ci.dev.example.com');
    await TestBed.inject(Router).navigateByUrl('/qits/services/qits-ci/runs/7');

    expect(
      appLinks.isCurrent(entry(appLinks, 'qits-ci'), {
        project: 'qits',
        category: 'services',
        repository: 'qits-ci',
      }),
    ).toBe(true);
    // Same host, another repository: the path says the reader is not there.
    expect(
      appLinks.isCurrent(entry(appLinks, 'qits-ci'), {
        project: 'qits',
        category: 'libs',
        repository: 'qits-eventstream',
      }),
    ).toBe(false);
  });

  it('is not current on somebody else’s host, whatever the path says', async () => {
    const appLinks = links('https://docs.dev.example.com');
    await TestBed.inject(Router).navigateByUrl('/qits/services/qits-ci/');

    expect(
      appLinks.isCurrent(entry(appLinks, 'qits-ci'), {
        project: 'qits',
        category: 'services',
        repository: 'qits-ci',
      }),
    ).toBe(false);
    expect(
      appLinks.isCurrent(entry(appLinks, 'qits-docs'), {
        project: 'qits',
        category: 'services',
        repository: 'qits-ci',
      }),
    ).toBe(true);
  });

  it('never marks an application without a host current: it has no address to compare', async () => {
    const appLinks = links('https://dev.example.com');
    await TestBed.inject(Router).navigateByUrl('/artifacts/images');
    expect(appLinks.isCurrent(entry(appLinks, 'qits-artifacts'), {})).toBe(false);
  });
});
