import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

export type QitsButtonVariant = 'primary' | 'secondary' | 'ghost';
export type QitsButtonSize = 'sm' | 'md' | 'lg';

/**
 * The one button every qits frontend renders. Presentational and self-contained: it owns its
 * styles, projects its label, and has no opinion about what a press means — the host binds
 * `(pressed)`.
 *
 * `busy` is deliberately separate from `disabled`. Both stop a press, but they say different
 * things to a screen reader (`aria-busy` on the first, nothing on the second) and a host that
 * conflated them could not show "working…" without also claiming the action is unavailable.
 */
@Component({
  selector: 'qits-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="classes()"
      [disabled]="inert()"
      [attr.aria-busy]="busy() ? 'true' : null"
      (click)="pressed.emit($event)"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .qits-button {
      font: inherit;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5em;
    }
    .qits-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .qits-button-sm {
      padding: 2px 8px;
      font-size: 13px;
    }
    .qits-button-md {
      padding: 6px 14px;
      font-size: 14px;
    }
    .qits-button-lg {
      padding: 10px 20px;
      font-size: 16px;
    }
    .qits-button-primary {
      background: #1f2937;
      color: #f9fafb;
    }
    .qits-button-primary:hover:not(:disabled) {
      background: #374151;
    }
    .qits-button-secondary {
      background: #f3f4f6;
      color: #111827;
      border-color: #d1d5db;
    }
    .qits-button-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }
    .qits-button-ghost {
      background: transparent;
      color: #1f2937;
    }
    .qits-button-ghost:hover:not(:disabled) {
      background: rgba(31, 41, 55, 0.08);
    }
  `,
})
export class QitsButton {
  readonly variant = input<QitsButtonVariant>('primary');
  readonly size = input<QitsButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly busy = input(false, { transform: booleanAttribute });

  readonly pressed = output<MouseEvent>();

  protected readonly inert = computed(() => this.disabled() || this.busy());
  protected readonly classes = computed(
    () => `qits-button qits-button-${this.variant()} qits-button-${this.size()}`,
  );
}
