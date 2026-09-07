import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BalanceBadgeComponent } from './balance-badge.component';

describe('BalanceBadgeComponent', () => {
  let fixture: ComponentFixture<BalanceBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanceBadgeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BalanceBadgeComponent);
  });

  it('Cenário BDD: deve renderizar valor positivo com classe de sucesso e formatação BRL', () => {
    fixture.componentRef.setInput('value', 1500);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.balance-badge') as HTMLElement;
    expect(el.textContent).toContain('1.500,00');
    expect(el.classList.contains('balance-badge--positive')).toBe(true);
  });

  it('Cenário BDD: deve renderizar valor negativo com classe de perigo', () => {
    fixture.componentRef.setInput('value', -350);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.balance-badge') as HTMLElement;
    expect(el.textContent).toContain('350,00');
    expect(el.classList.contains('balance-badge--negative')).toBe(true);
  });
});
