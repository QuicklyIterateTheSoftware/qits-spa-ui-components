import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { QitsPicker, type QitsPickerOption } from './picker';

describe('QitsPicker', () => {
  interface Env {
    readonly id: string;
  }

  const OPTIONS: readonly QitsPickerOption<Env>[] = [
    { value: { id: 'dev' }, label: 'Development' },
    { value: { id: 'prod' }, label: 'Production' },
  ];

  function render(
    options: readonly QitsPickerOption<Env>[] = OPTIONS,
  ): ComponentFixture<QitsPicker<Env>> {
    const fixture = TestBed.createComponent<QitsPicker<Env>>(QitsPicker);
    fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
    return fixture;
  }

  function query<E extends Element>(
    fixture: ComponentFixture<unknown>,
    selector: string,
  ): E | null {
    return fixture.nativeElement.querySelector(selector) as E | null;
  }

  function rows(fixture: ComponentFixture<unknown>): HTMLLIElement[] {
    return [...fixture.nativeElement.querySelectorAll('.qits-picker-option')];
  }

  function keydown(fixture: ComponentFixture<unknown>, key: string): void {
    query(fixture, '.qits-picker-list')?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
  }

  it('is the list when nothing is picked', () => {
    const fixture = render();
    expect(rows(fixture).map((row) => row.textContent?.trim())).toEqual([
      'Development',
      'Production',
    ]);
    expect(query(fixture, '.qits-picker-value')).toBeNull();
    expect(query(fixture, '.qits-picker-clear')).toBeNull();
  });

  it('collapses the list into the bar on a pick, and emits the value', () => {
    const fixture = render();
    const emitted: (Env | undefined)[] = [];
    fixture.componentInstance.value.subscribe((value) => emitted.push(value));

    rows(fixture)[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ id: 'prod' }]);
    expect(query(fixture, '.qits-picker-value')?.textContent).toBe('Production');
    expect(rows(fixture)).toHaveLength(0);
  });

  it('puts the list back when cleared, emitting undefined', () => {
    const fixture = render();
    rows(fixture)[0].click();
    fixture.detectChanges();

    const emitted: (Env | undefined)[] = [];
    fixture.componentInstance.value.subscribe((value) => emitted.push(value));
    query<HTMLButtonElement>(fixture, '.qits-picker-clear')?.click();
    fixture.detectChanges();

    expect(emitted).toEqual([undefined]);
    expect(rows(fixture)).toHaveLength(2);
  });

  // Hover and the arrow keys mean the same thing: pending, not picked.
  it('carries a half-opacity caret on the hovered row, and nothing on the others', () => {
    const fixture = render();
    rows(fixture)[1].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(rows(fixture)[0].querySelector('.qits-picker-caret')).toBeNull();
    expect(rows(fixture)[1].querySelector('.qits-picker-caret')).not.toBeNull();
    expect(rows(fixture)[1].querySelector('.qits-picker-caret-locked')).toBeNull();
    expect(fixture.componentInstance.value()).toBeUndefined();
  });

  it('locks the caret into the bar once a value is held', () => {
    const fixture = render();
    rows(fixture)[0].click();
    fixture.detectChanges();
    expect(query(fixture, '.qits-picker-bar .qits-picker-caret-locked')).not.toBeNull();
  });

  it('moves the caret with the arrow keys, wrapping, and picks on Enter', () => {
    const fixture = render();
    const list = query<HTMLElement>(fixture, '.qits-picker-list');
    expect(list?.getAttribute('aria-activedescendant')).toBeNull();

    keydown(fixture, 'ArrowDown');
    expect(rows(fixture)[0].id).toBe(list?.getAttribute('aria-activedescendant'));

    keydown(fixture, 'ArrowUp');
    keydown(fixture, 'ArrowUp');
    expect(rows(fixture)[0].id).toBe(list?.getAttribute('aria-activedescendant'));

    keydown(fixture, 'End');
    keydown(fixture, 'Enter');
    expect(fixture.componentInstance.value()).toEqual({ id: 'prod' });
  });

  it('shows the list for a value it holds no option for', () => {
    const fixture = render();
    fixture.componentRef.setInput('value', { id: 'staging' });
    fixture.detectChanges();
    expect(rows(fixture)).toHaveLength(2);
    expect(query(fixture, '.qits-picker-value')).toBeNull();
  });

  it('matches object values through compareWith', () => {
    const fixture = render();
    fixture.componentRef.setInput('compareWith', (a: Env, b: Env) => a.id === b.id);
    fixture.componentRef.setInput('value', { id: 'dev' });
    fixture.detectChanges();
    expect(query(fixture, '.qits-picker-value')?.textContent).toBe('Development');
  });

  it('picks nothing while disabled', () => {
    const fixture = render();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    rows(fixture)[0].click();
    keydown(fixture, 'ArrowDown');
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBeUndefined();
    expect(query(fixture, '.qits-picker-list')?.getAttribute('tabindex')).toBeNull();
  });

  it('stands in a message for an empty list rather than an empty box', () => {
    const fixture = render([]);
    expect(query(fixture, '.qits-picker-list')).toBeNull();
    expect(query(fixture, '.qits-picker-empty')?.textContent).toBe('No options');
  });
});
