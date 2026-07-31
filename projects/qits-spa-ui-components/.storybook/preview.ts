import { setCompodocJson } from '@storybook/addon-docs/angular';
import type { Preview } from '@storybook/angular-vite';
import docJson from '../documentation.json';

// documentation.json is generated, never committed — the framework's `compodoc: true` writes it
// before either Storybook target starts.
setCompodocJson(docJson);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The lint config already runs angular-eslint's template-accessibility rules; this is the same
    // concern checked against what actually rendered. 'todo' reports without failing.
    a11y: { test: 'todo' },
  },
};

export default preview;
