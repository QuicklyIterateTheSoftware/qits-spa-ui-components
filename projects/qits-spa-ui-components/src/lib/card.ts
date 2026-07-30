import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A titled surface to group related content. The header is rendered only when a `heading` is
 * given, so an untitled card is a plain panel rather than an empty `<h3>` a screen reader has to
 * announce.
 *
 * Two projection slots: `[qitsCardActions]` lands in the header beside the title, everything else
 * falls into the body.
 */
@Component({
  selector: 'qits-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="elevated() ? 'qits-card qits-card-elevated' : 'qits-card'">
      @if (heading()) {
        <header class="qits-card-header">
          <div class="qits-card-headings">
            <h3 class="qits-card-title">{{ heading() }}</h3>
            @if (subheading()) {
              <p class="qits-card-subtitle">{{ subheading() }}</p>
            }
          </div>
          <ng-content select="[qitsCardActions]" />
        </header>
      }
      <div class="qits-card-body">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .qits-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    .qits-card-elevated {
      border-color: transparent;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.12),
        0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .qits-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
    }
    .qits-card-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }
    .qits-card-subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      color: #6b7280;
    }
    .qits-card-body {
      padding: 16px;
    }
  `,
})
export class QitsCard {
  readonly heading = input<string>('');
  readonly subheading = input<string>('');
  readonly elevated = input(false, { transform: booleanAttribute });
}
