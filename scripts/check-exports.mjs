import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// This library is registry-first: nothing installs the repo, so there is no root manifest to keep
// in sync with dist's. What can still go wrong is the *published* artifact — ng-packagr writes
// dist/package.json from projects/<lib>/package.json, and a manifest that names the wrong package,
// carries `private`, or points `exports` at files the build did not emit only fails at `npm
// publish` time, or worse, at a consumer's `import`. So this checks the thing being published.

const PROJECT = 'projects/qits-spa-ui-components/package.json';
const DIST = 'dist/qits-spa-ui-components';
const EXPECTED_NAME = '@qits/ui-components';

const project = JSON.parse(readFileSync(PROJECT, 'utf8'));
const dist = JSON.parse(readFileSync(`${DIST}/package.json`, 'utf8'));

let failed = false;
const fail = (message) => {
  console.error(message);
  failed = true;
};

if (dist.name !== EXPECTED_NAME) {
  fail(`name drift: dist declares ${dist.name}, this repo publishes ${EXPECTED_NAME}`);
}
if (dist.version !== project.version) {
  fail(`version drift: dist says ${dist.version}, ${PROJECT} says ${project.version}`);
}
// publish-if-absent reads the version out of PROJECT and npm reads it out of the tarball; a
// `private` flag would make the publish step fail after the whole pipeline had already gone green.
if (dist.private) {
  fail(`dist/package.json carries private: true — it would refuse to publish`);
}
for (const [pkg, range] of Object.entries(project.peerDependencies ?? {})) {
  if (dist.peerDependencies?.[pkg] !== range) {
    fail(
      `peer drift: ${PROJECT} declares ${pkg}@${range}, dist has ${dist.peerDependencies?.[pkg]}`,
    );
  }
}

// Every path the entry point advertises has to exist, or the package resolves to nothing.
const walk = (node, path) => {
  if (typeof node === 'string') {
    if (!existsSync(resolve(DIST, node))) {
      fail(`exports.${path} points at ${node}, which the build did not emit`);
    }
    return;
  }
  for (const [key, value] of Object.entries(node ?? {})) {
    walk(value, `${path}.${key}`);
  }
};
walk(dist.exports ?? {}, '');

if (failed) process.exit(1);
console.log(`publishable: ${dist.name}@${dist.version} in ${DIST} (exports resolve, not private)`);
