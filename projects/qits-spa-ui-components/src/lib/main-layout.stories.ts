import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  argsToTemplate,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';

import { QitsBadge } from './badge';
import { QitsCard } from './card';
import { QITS_NAV_LINKS, QitsMainLayout } from './main-layout';

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

// The layout hosts a `<router-outlet />`, which needs a router in scope. `applicationConfig` is
// where the angular-vite framework takes providers, and an empty route table is enough: the stories
// document the chrome, not what routes into it.
//
// The breakpoint is CSS, so the way to see both shapes is the viewport toolbar, or simply a narrower
// browser window — there is no `mobile` input to flip.
const meta: Meta<QitsMainLayout> = {
  title: 'Layout/MainLayout',
  component: QitsMainLayout,
  tags: ['autodocs'],
  args: { brand: 'qits', links: QITS_NAV_LINKS },
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
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
 * `links` defaults to every SPA of the platform, but it is an input: an app that owns a section can
 * hand in its own list, or splice entries into `QITS_NAV_LINKS` and pass the result.
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
 * The layout is a *route* component: nothing sits inside its tags, the child routes render into its
 * `<router-outlet />`. This story wires one up so the content area has something in it, and so the
 * scrolling — content only, navigation fixed — is visible.
 */
export const WithRoutedChild: Story = {
  name: 'With a routed child',
  decorators: [
    applicationConfig({ providers: [provideRouter([{ path: '**', component: Child }])] }),
  ],
};
