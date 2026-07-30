import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { QitsButton } from './button';

describe('QitsButton', () => {
  function render(): ComponentFixture<QitsButton> {
    const fixture = TestBed.createComponent(QitsButton);
    fixture.detectChanges();
    return fixture;
  }

  function nativeButton(fixture: ComponentFixture<unknown>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  // Angular's class binding does not promise an order, only a set.
  function classes(element: Element): string[] {
    return [...element.classList].sort();
  }

  it('defaults to an enabled primary button of medium size', () => {
    const button = nativeButton(render());
    expect(classes(button)).toEqual(['qits-button', 'qits-button-md', 'qits-button-primary']);
    expect(button.type).toBe('button');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('spells variant and size into the class list', () => {
    const fixture = render();
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect(classes(nativeButton(fixture))).toEqual([
      'qits-button',
      'qits-button-ghost',
      'qits-button-lg',
    ]);
  });

  it('busy blocks the press and says so, disabled blocks it silently', () => {
    const fixture = render();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(nativeButton(fixture).disabled).toBe(true);
    expect(nativeButton(fixture).getAttribute('aria-busy')).toBe('true');

    fixture.componentRef.setInput('busy', false);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(nativeButton(fixture).disabled).toBe(true);
    expect(nativeButton(fixture).getAttribute('aria-busy')).toBeNull();
  });

  it('coerces the string form of the boolean inputs, as a template attribute writes them', () => {
    const fixture = render();
    fixture.componentRef.setInput('disabled', '');
    fixture.detectChanges();
    expect(nativeButton(fixture).disabled).toBe(true);
  });

  it('emits pressed with the originating event', () => {
    const fixture = render();
    const seen: MouseEvent[] = [];
    fixture.componentInstance.pressed.subscribe((event) => seen.push(event));
    nativeButton(fixture).click();
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('click');
  });

  it('projects its label', () => {
    @Component({
      imports: [QitsButton],
      template: `<qits-button>Deploy</qits-button>`,
    })
    class Host {}

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(nativeButton(fixture).textContent?.trim()).toBe('Deploy');
  });
});
