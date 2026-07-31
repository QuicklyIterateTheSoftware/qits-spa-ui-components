# @qits/ui-components

Angular components shared across qits frontends: `QitsButton`, `QitsBadge`, `QitsCard` and the
application skeleton `QitsMainLayout`. Standalone, `OnPush`, self-contained styles; `@angular/core`
and `@angular/common` are peers, and `@angular/router` for the layout's `<router-outlet />`.

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

`QitsMainLayout` is the root *route* component, not a wrapper tag — mounting it there is what keeps
the chrome alive across navigation:

```ts
import { QITS_NAV_LINKS, QitsMainLayout } from '@qits/ui-components';

export const routes: Routes = [
  { path: '', component: QitsMainLayout, children: [/* the app */] },
];
```

Sidebar from 768px up, burger below it, all in CSS. Its `links` default to `QITS_NAV_LINKS` —
every SPA of the platform, as plain `<a href>` paths, because each one is a separate application
behind its own base path.

Source, the component reference and the development commands are in the
[repository README](https://github.com/QuicklyIterateTheSoftware/qits-spa-ui-components).
