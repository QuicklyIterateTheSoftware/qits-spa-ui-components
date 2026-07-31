import type { StorybookConfig } from '@storybook/angular-vite';

// Angular 21 builds through Vite here, so Storybook does too: `@storybook/angular-vite` shares
// that pipeline. The webpack-era `@storybook/angular` would stand up a second, contradictory
// toolchain and is deliberately not installed.
//
// Stories sit beside the components they document, under src/lib — the same place the specs live.
// tsconfig.lib.json excludes both suffixes, so neither reaches the published package.
//
// compodoc is what gives Angular docs their property tables: it reads the JSDoc and the `input()`
// signatures out of the source and writes documentation.json, which preview.ts hands to the docs
// addon. Without it the docs pages render, but every component arrives undescribed.
const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular-vite',
    options: {
      compodoc: true,
      compodocArgs: ['-e', 'json', '-d', 'projects/qits-spa-ui-components'],
    },
  },
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
};

export default config;
