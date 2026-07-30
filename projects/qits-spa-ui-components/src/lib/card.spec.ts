import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { QitsCard } from './card';

describe('QitsCard', () => {
  function render(): ComponentFixture<QitsCard> {
    const fixture = TestBed.createComponent(QitsCard);
    fixture.detectChanges();
    return fixture;
  }

  it('renders no header at all when there is no heading', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('.qits-card-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('h3')).toBeNull();
    expect(fixture.nativeElement.querySelector('.qits-card-body')).not.toBeNull();
  });

  it('renders the heading, and the subtitle only when given one', () => {
    const fixture = render();
    fixture.componentRef.setInput('heading', 'Latest run');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Latest run');
    expect(fixture.nativeElement.querySelector('.qits-card-subtitle')).toBeNull();

    fixture.componentRef.setInput('subheading', 'main @ 18f7422');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.qits-card-subtitle').textContent).toBe(
      'main @ 18f7422',
    );
  });

  it('elevation is a class on the surface, not a wrapper', () => {
    const fixture = render();
    const section = fixture.nativeElement.querySelector('section') as HTMLElement;
    expect([...section.classList].sort()).toEqual(['qits-card']);
    fixture.componentRef.setInput('elevated', '');
    fixture.detectChanges();
    expect([...section.classList].sort()).toEqual(['qits-card', 'qits-card-elevated']);
  });

  it('splits projected content between the header actions slot and the body', () => {
    @Component({
      imports: [QitsCard],
      template: `
        <qits-card heading="Latest run">
          <button qitsCardActions type="button">Re-run</button>
          <p>All steps green.</p>
        </qits-card>
      `,
    })
    class Host {}

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.qits-card-header') as HTMLElement;
    const body = fixture.nativeElement.querySelector('.qits-card-body') as HTMLElement;
    expect(header.querySelector('button')?.textContent).toBe('Re-run');
    expect(body.querySelector('button')).toBeNull();
    expect(body.textContent?.trim()).toBe('All steps green.');
  });
});
