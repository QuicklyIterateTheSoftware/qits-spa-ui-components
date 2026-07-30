# @qits/ui-components

Presentational Angular components shared across qits frontends: `QitsButton`, `QitsBadge` and
`QitsCard`. Standalone, `OnPush`, self-contained styles, `@angular/core` and `@angular/common` as
the only peers.

## Install

The package is served from the platform's own npm repository, not npmjs — route the scope in an
`.npmrc` beside your `package.json`:

    registry=http://localhost:8081/artifacts/npm/npmjs/     # everything, through the npmjs cache
    @qits:registry=http://localhost:8081/artifacts/npm/npm/ # ours

    pnpm add @qits/ui-components

```ts
import { QitsBadge, QitsButton, QitsCard } from '@qits/ui-components';

@Component({
  imports: [QitsButton, QitsBadge, QitsCard],
  template: `
    <qits-card heading="Latest run" elevated>
      <qits-button qitsCardActions size="sm" variant="secondary" (pressed)="rerun()">
        Re-run
      </qits-button>
      <qits-badge label="SUCCESS" tone="success" />
    </qits-card>
  `,
})
export class RunSummary { /* … */ }
```

Source, the component reference and the development commands are in the
[repository README](https://github.com/QuicklyIterateTheSoftware/qits-spa-ui-components).
