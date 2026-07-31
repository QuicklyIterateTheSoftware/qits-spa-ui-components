import { argsToTemplate, type Meta, type StoryObj } from '@storybook/angular-vite';

import { QitsButton } from './button';

// The button projects its label, so every story supplies a `template` rather than an `args` label:
// there is no input to bind content to, and pretending otherwise would document an API we do not
// have.
const meta: Meta<QitsButton> = {
  title: 'Components/Button',
  component: QitsButton,
  tags: ['autodocs'],
  args: { variant: 'primary', size: 'md', type: 'button', disabled: false, busy: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
  },
  render: (args) => ({
    props: args,
    template: `<qits-button ${argsToTemplate(args)}>Re-run</qits-button>`,
  }),
};

export default meta;
type Story = StoryObj<QitsButton>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Ghost: Story = { args: { variant: 'ghost' } };

export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: center; gap: 8px">
        <qits-button size="sm">Small</qits-button>
        <qits-button size="md">Medium</qits-button>
        <qits-button size="lg">Large</qits-button>
      </div>
    `,
  }),
};

/**
 * `disabled` and `busy` both stop a press, and look alike on purpose — the difference is what they
 * announce. Only `busy` sets `aria-busy`, so a host can say "working…" without also claiming the
 * action is unavailable.
 */
export const DisabledVersusBusy: Story = {
  name: 'Disabled vs. busy',
  render: () => ({
    template: `
      <div style="display: flex; align-items: center; gap: 8px">
        <qits-button disabled>Disabled</qits-button>
        <qits-button busy>Working…</qits-button>
      </div>
    `,
  }),
};
