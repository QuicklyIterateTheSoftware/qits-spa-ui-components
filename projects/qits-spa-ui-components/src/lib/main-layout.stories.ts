import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  argsToTemplate,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';

import { QitsBadge } from './badge';
import { QitsCard } from './card';
import { QitsMainLayout } from './main-layout';
import { QitsNavSubmenu } from './nav-submenu';
import { provideQitsNavigationLinks, QITS_NAVIGATION, type QitsNavLink } from './navigation';

/** Stand-in for whatever an app routes into the layout. */
@Component({
  selector: 'qits-story-child',
  imports: [QitsBadge, QitsCard],
  template: `
    @for (run of runs; track run) {
      <qits-card heading="Latest run" [subheading]="run" elevated style="margin-bottom: 12px">
        <qits-badge label="SUCCESS" tone="success" />
      </qits-card>
    }
  `,
})
class Child {
  protected readonly runs = Array.from({ length: 12 }, (_, i) => `main @ commit ${12 - i}`);
}

/** What a running platform would answer with. The workbench has no gateway in front of it. */
const DEMO_LINKS: readonly QitsNavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'CI', href: '/ci/' },
  { label: 'Deployments', href: '/platform-deployments/' },
  { label: 'Artifacts', href: '/artifacts/' },
  { label: 'Projects', href: '/projects/' },
];

// The layout hosts a `<router-outlet />`, which needs a router in scope, and it asks
// `QITS_NAVIGATION` for its links. `applicationConfig` is where the angular-vite framework takes
// providers: an empty route table is enough — the stories document the chrome, not what routes into
// it — and `provideQitsNavigationLinks` stands in for the gateway without a request being made.
//
// The breakpoint is CSS, so the way to see both shapes is the viewport toolbar, or simply a narrower
// browser window — there is no `mobile` input to flip.
const meta: Meta<QitsMainLayout> = {
  title: 'Layout/MainLayout',
  component: QitsMainLayout,
  tags: ['autodocs'],
  args: { brand: 'qits' },
  decorators: [
    applicationConfig({ providers: [provideRouter([]), provideQitsNavigationLinks(DEMO_LINKS)] }),
  ],
  render: (args) => ({
    props: args,
    template: `<qits-main-layout ${argsToTemplate(args)} />`,
  }),
};

export default meta;
type Story = StoryObj<QitsMainLayout>;

export const Default: Story = {};

export const Branded: Story = { args: { brand: 'qits ci' } };

/**
 * `links` is an explicit override, and a non-empty one suppresses the navigation source entirely.
 * That is how an app renders its own list — a preview, a section it owns — without unwiring the
 * provider it will use in production.
 */
export const OwnLinks: Story = {
  name: 'Own links',
  args: {
    brand: 'qits docs',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Guides', href: '/docs/guides/' },
      { label: 'Reference', href: '/docs/reference/' },
    ],
  },
};

/**
 * Nothing has answered yet. The navigation renders no entries and carries `aria-busy`, rather than
 * showing a compiled-in guess that might disagree with what the platform actually routes.
 */
export const Waiting: Story = {
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([]),
        // A source that is simply never answered — what the first paint of every SPA looks like.
        { provide: QITS_NAVIGATION, useValue: { links: signal(undefined), failed: signal(false) } },
      ],
    }),
  ],
};

/**
 * The navigation could not be fetched, or came back empty. One way out — the gateway's own root,
 * which is not a registry entry and so cannot go stale — under a line saying what happened.
 */
export const Stranded: Story = {
  decorators: [
    applicationConfig({ providers: [provideRouter([]), provideQitsNavigationLinks([])] }),
  ],
};

/**
 * An application's own sub-menu, under the entry that is that application. The layout gives it a
 * bare block and styles nothing inside it — everything visible here belongs to the story.
 *
 * Declare the `<ng-template qitsNavSubmenu>` in the app shell beside the `<router-outlet />`, never
 * inside a page: a page's declaration is rebuilt on every navigation, and the panel would lose its
 * scroll position and its open groups on each hop.
 *
 * The workbench is served from `/iframe.html`, so no entry here *is* this application and the
 * sub-menu falls to the foot of the navigation — the placement a SPA the gateway does not route
 * yet also gets. In a deployed SPA it sits under that SPA's own entry.
 */
export const WithSubmenu: Story = {
  name: 'With a sub-menu',
  decorators: [moduleMetadata({ imports: [QitsNavSubmenu] })],
  render: (args) => ({
    props: args,
    template: `
      <qits-main-layout ${argsToTemplate(args)} />
      <ng-template qitsNavSubmenu>
        <ul style="list-style:none;margin:0;padding:0 8px 8px 22px;font-size:13px">
          <li><a href="/getting-started/" style="color:#374151">Getting started</a></li>
          <li><a href="/architecture/" style="color:#374151">Architecture</a></li>
          <li><a href="/reference/" style="color:#374151">Reference</a></li>
        </ul>
      </ng-template>
    `,
  }),
};

/**
 * The layout is a *route* component: nothing sits inside its tags, the child routes render into its
 * `<router-outlet />`. This story wires one up so the content area has something in it, and so the
 * scrolling — content only, navigation fixed — is visible.
 */
export const WithRoutedChild: Story = {
  name: 'With a routed child',
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([{ path: '**', component: Child }]),
        provideQitsNavigationLinks(DEMO_LINKS),
      ],
    }),
  ],
};
