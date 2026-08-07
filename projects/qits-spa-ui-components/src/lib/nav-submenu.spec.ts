import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal, type TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QitsNavSubmenu, QitsNavSubmenuSlot } from './nav-submenu';

describe('QitsNavSubmenuSlot', () => {
  /** A host that can declare each template independently, which is how pages come and go. */
  @Component({
    imports: [QitsNavSubmenu],
    template: `
      @if (showFirst()) {
        <ng-template qitsNavSubmenu>first</ng-template>
      }
      @if (showSecond()) {
        <ng-template qitsNavSubmenu>second</ng-template>
      }
    `,
  })
  class Host {
    readonly showFirst = signal(true);
    readonly showSecond = signal(false);
  }

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, slot: TestBed.inject(QitsNavSubmenuSlot) };
  }

  it('offers nothing until something registers', () => {
    expect(TestBed.inject(QitsNavSubmenuSlot).template()).toBeNull();
  });

  it('takes the template a directive declares', () => {
    const { slot } = render();
    expect(slot.template()).not.toBeNull();
  });

  it('offers the newest template while both are alive', () => {
    const { fixture, slot } = render();
    const first = slot.template();

    fixture.componentInstance.showSecond.set(true);
    fixture.detectChanges();
    expect(slot.template()).not.toBe(first);
  });

  /**
   * The case a single nullable field gets wrong. `RouterOutlet` creates the incoming page before it
   * destroys the outgoing one, so the *older* declaration is the one torn down last — and it must
   * not take the live template with it.
   */
  it('keeps the survivor when the older declaration is destroyed last', () => {
    const { fixture, slot } = render();
    fixture.componentInstance.showSecond.set(true);
    fixture.detectChanges();
    const second = slot.template();

    fixture.componentInstance.showFirst.set(false);
    fixture.detectChanges();
    expect(slot.template()).toBe(second);
  });

  it('offers nothing again once every declaration is gone', () => {
    const { fixture, slot } = render();
    fixture.componentInstance.showFirst.set(false);
    fixture.detectChanges();
    expect(slot.template()).toBeNull();
  });

  it('releases by identity, so releasing one leaves the other', () => {
    const slot = TestBed.inject(QitsNavSubmenuSlot);
    const a = {} as TemplateRef<unknown>;
    const b = {} as TemplateRef<unknown>;

    slot.register(a);
    slot.register(b);
    slot.release(a);
    expect(slot.template()).toBe(b);
  });
});

describe('QitsNavSubmenu', () => {
  /** What the layout does with the template, without pulling the whole layout into this spec. */
  @Component({
    imports: [QitsNavSubmenu, NgTemplateOutlet],
    template: `
      <ng-template qitsNavSubmenu><b class="declared">tree</b></ng-template>
      @if (slot.template(); as tpl) {
        <div class="outlet"><ng-container [ngTemplateOutlet]="tpl" /></div>
      }
    `,
  })
  class Host {
    protected readonly slot = inject(QitsNavSubmenuSlot);
  }

  it('renders the declared content wherever the template is inserted', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.outlet .declared')?.textContent).toBe('tree');
  });

  it('contributes no element where the template itself sits', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    // An `<ng-template>` renders as a comment, so the content exists once: at the insertion point.
    expect(fixture.nativeElement.querySelectorAll('.declared')).toHaveLength(1);
  });
});
