import type { Meta, StoryObj } from '@storybook/angular-vite';

import { QitsPicker } from './picker';

const ENVIRONMENTS = [
  { value: 'dev', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Production' },
];

const meta: Meta<QitsPicker<string>> = {
  title: 'Components/Picker',
  component: QitsPicker,
  tags: ['autodocs'],
  args: { options: ENVIRONMENTS, value: undefined },
  argTypes: { value: { control: false } },
};

export default meta;
type Story = StoryObj<QitsPicker<string>>;

/**
 * Nothing picked, so the list is simply there — hover a row, or tab to the list and arrow through
 * it, and the caret appears in the rail at half opacity.
 */
export const Empty: Story = {};

/** Picked: the caret is locked in the bar, the label sits beside it, and ✕ puts the list back. */
export const Selected: Story = { args: { value: 'staging' } };

export const WithPlaceholder: Story = {
  name: 'With placeholder',
  args: { placeholder: 'Pick an environment' },
};

export const Disabled: Story = { args: { value: 'prod', disabled: true } };

/** Nothing to pick is a sentence, not an empty box. */
export const NoOptions: Story = { name: 'No options', args: { options: [] } };
