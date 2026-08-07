import {
  computed,
  DestroyRef,
  Directive,
  inject,
  Injectable,
  signal,
  TemplateRef,
} from '@angular/core';

/**
 * The templates offered for the sub-menu slot beneath the current navigation entry, newest last.
 *
 * A **stack**, not a slot, and the reason is a correctness one. Two pages are alive at once during
 * a navigation: `RouterOutlet` destroys the outgoing component *after* it has created the incoming
 * one. With a single nullable field the page destroyed last would clear a template belonging to the
 * page now on screen, and the sub-menu would silently vanish on some hops and not others. A stack
 * plus `release()` filtering **by identity** means an entry can only ever remove itself, whatever
 * order the teardown happens in.
 *
 * `providedIn: 'root'` rather than a module-level `let`, because root means one instance per
 * `EnvironmentInjector` — which is what keeps two server renders happening at the same moment from
 * pushing into each other's stack.
 */
@Injectable({ providedIn: 'root' })
export class QitsNavSubmenuSlot {
  private readonly registered = signal<readonly TemplateRef<unknown>[]>([]);

  /** The template to render: the most recent one still registered, or nothing. */
  readonly template = computed(() => this.registered().at(-1) ?? null);

  register(template: TemplateRef<unknown>): void {
    this.registered.update((stack) => [...stack, template]);
  }

  release(template: TemplateRef<unknown>): void {
    this.registered.update((stack) => stack.filter((entry) => entry !== template));
  }
}

/**
 * Marks an `<ng-template>` as the sub-menu of the current navigation entry — a documentation tree,
 * a version picker, whatever the application wants under its own name in the chrome. The layout
 * renders it in a bare block and styles nothing inside it.
 *
 * **Declare it in the app shell, beside the `<router-outlet />`, never inside a page.** Getting
 * this wrong is silent: a page's declaration is destroyed and rebuilt on every navigation, so the
 * panel would lose its scroll position and every open group on each hop, in a menu that did not
 * itself change. Declared in the shell it is built once at bootstrap and never torn down.
 *
 * ```html
 * <ng-template qitsNavSubmenu>
 *   <app-doc-tree />
 * </ng-template>
 * <router-outlet />
 * ```
 *
 * The content keeps the style scope of the component that *declared* it, not the layout's: view
 * encapsulation is decided where a node is written, not where it is inserted. So the shell's own
 * component styles apply, and none of the layout's leak in.
 */
@Directive({ selector: '[qitsNavSubmenu]' })
export class QitsNavSubmenu {
  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const slot = inject(QitsNavSubmenuSlot);
    slot.register(template);
    inject(DestroyRef).onDestroy(() => slot.release(template));
  }
}
