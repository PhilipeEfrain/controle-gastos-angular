import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaxComparisonCardComponent } from './tax-comparison-card.component';

describe('TaxComparisonCardComponent', () => {
  let component: TaxComparisonCardComponent;
  let fixture: ComponentFixture<TaxComparisonCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxComparisonCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TaxComparisonCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('totalBudget', 3000);
    fixture.componentRef.setInput('totalPaid', 1200);
    fixture.componentRef.setInput('taxesCount', 3);
    fixture.componentRef.setInput('paidCount', 1);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar os valores formatados de orçado, pago e saldo a quitar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('3.000,00');
    expect(compiled.textContent).toContain('1.200,00');
    expect(compiled.textContent).toContain('1.800,00');
    expect(compiled.textContent).toContain('1 de 3 tributos liquidados (40%)');
  });

  it('deve indicar 100% quitado quando todos os tributos estiverem pagos', () => {
    fixture.componentRef.setInput('totalPaid', 3000);
    fixture.componentRef.setInput('paidCount', 3);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('100% Quitado');
  });
});
