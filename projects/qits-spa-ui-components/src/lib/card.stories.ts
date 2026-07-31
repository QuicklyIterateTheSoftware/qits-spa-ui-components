import { argsToTemplate, type Meta, type StoryObj } from '@storybook/angular-vite';

import { QitsBadge } from './badge';
import { QitsButton } from './button';
import { QitsCard } from './card';

// The card is the one component here that composes: the header takes `[qitsCardActions]` and the
// body takes everything else, so its stories import the button and badge to show both slots
// carrying something real.
const meta: Meta<QitsCard> = {
  title: 'Components/Card',
  component: QitsCard,
  subcomponents: { QitsBadge, QitsButton },
  tags: ['autodocs'],
  args: { heading: 'Latest run', subheading: 'main @ 18f7422', elevated: false },
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [QitsBadge, QitsButton] },
    template: `
      <qits-card ${argsToTemplate(args)}>
        <qits-button qitsCardActions size="sm" variant="secondary">Re-run</qits-button>
        <qits-badge label="SUCCESS" tone="success" />
      </qits-card>
    `,
  }),
};

export default meta;
type Story = StoryObj<QitsCard>;

export const Default: Story = {};

export const Elevated: Story = { args: { elevated: true } };

/**
 * With no `heading` the header is not rendered at all, so an untitled card is a plain panel rather
 * than an empty `<h3>` a screen reader has to announce.
 */
export const Untitled: Story = {
  render: () => ({
    template: `<qits-card>Nothing here needs a title.</qits-card>`,
  }),
};
