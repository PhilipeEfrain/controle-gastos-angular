import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeficitAlertBannerComponent } from './deficit-alert-banner.component';

describe('DeficitAlertBannerComponent', () => {
  let fixture: ComponentFixture<DeficitAlertBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeficitAlertBannerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DeficitAlertBannerComponent);
  });

  it('não deve renderizar banner se não houver déficit', () => {
    fixture.componentRef.setInput('temDeficitGlobal', false);
    fixture.componentRef.setInput('saldoQ2', 500);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.deficit-banner');
    expect(banner).toBeNull();
  });

  it('Cenário BDD: deve renderizar alerta de compensação em âmbar quando Q1 cobrir Q2', () => {
    fixture.componentRef.setInput('temDeficitGlobal', false);
    fixture.componentRef.setInput('saldoQ1', 1000);
    fixture.componentRef.setInput('saldoQ2', -600);
    fixture.componentRef.setInput('q1CobreQ2', true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.deficit-banner');
    expect(banner).toBeTruthy();
    expect(banner.classList.contains('deficit-banner--warning')).toBe(true);
    expect(banner.textContent).toContain('Tudo certo: sua próxima quinzena está coberta.');
  });

  it('Cenário BDD: deve renderizar banner crítico em carmim quando houver déficit global', () => {
    fixture.componentRef.setInput('temDeficitGlobal', true);
    fixture.componentRef.setInput('saldoFinal', -500);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.deficit-banner');
    expect(banner).toBeTruthy();
    expect(banner.classList.contains('deficit-banner--critical')).toBe(true);
    expect(banner.textContent).toContain('Déficit Orçamentário no Mês');
  });
});
