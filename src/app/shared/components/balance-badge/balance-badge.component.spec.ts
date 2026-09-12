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

  it('Cenário BDD: deve renderizar indicador * com tooltip quando hasExtraIncome for true', () => {
    fixture.componentRef.setInput('value', 2300);
    fixture.componentRef.setInput('hasExtraIncome', true);
    fixture.componentRef.setInput('extraIncomeAmount', 500);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.extra-income-indicator') as HTMLElement;
    expect(indicator).toBeTruthy();
    expect(indicator.textContent?.trim()).toBe('*');
    expect(indicator.getAttribute('title')).toContain('Saldo com acréscimo de renda extra');
    expect(indicator.getAttribute('title')).toContain('500,00');
    expect(indicator.getAttribute('aria-label')).toContain('Saldo com acréscimo de renda extra');
  });

  it('Cenário BDD: NÃO deve renderizar indicador * quando hasExtraIncome for false', () => {
    fixture.componentRef.setInput('value', 2000);
    fixture.componentRef.setInput('hasExtraIncome', false);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('.extra-income-indicator');
    expect(indicator).toBeNull();
  });
});
