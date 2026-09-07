import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FortnightCardComponent } from './fortnight-card.component';
import { FortnightSummary, Expense } from '../../../../core/models/finance.model';

describe('FortnightCardComponent', () => {
  let component: FortnightCardComponent;
  let fixture: ComponentFixture<FortnightCardComponent>;

  const mockSummary: FortnightSummary = {
    quinzena: 1,
    label: '1ª Quinzena (Dia 31)',
    renda: 2500,
    totalGastos: 1500,
    saldo: 1000,
    isDeficit: false,
    percentualGasto: 60
  };

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      descricao: 'Aluguel',
      valor: 1200,
      quinzena: 1,
      categoria: 'Moradia',
      status_pagamento: true
    },
    {
      id: 'exp-2',
      descricao: 'Internet Fibra',
      valor: 150,
      quinzena: 1,
      categoria: 'Serviços',
      status_pagamento: false
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FortnightCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FortnightCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('quinzena', 1);
    fixture.componentRef.setInput('summary', mockSummary);
    fixture.componentRef.setInput('expenses', mockExpenses);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o título da Quinzena 1 e métricas', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1ª Quinzena');
    expect(compiled.textContent).toContain('Renda do Dia 31');
    expect(compiled.textContent).toContain('2.500,00');
    expect(compiled.textContent).toContain('1.500,00');
  });

  it('deve renderizar as linhas de despesas passadas', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Aluguel');
    expect(compiled.textContent).toContain('Internet Fibra');
  });

  it('deve emitir addExpense ao clicar em Nova Despesa', () => {
    let emittedQuinzena: number | undefined;
    component.addExpense.subscribe(q => emittedQuinzena = q);

    const addBtn = fixture.nativeElement.querySelector('.add-expense-btn') as HTMLButtonElement;
    addBtn.click();

    expect(emittedQuinzena).toBe(1);
  });

  it('deve emitir editIncome ao clicar no botão Renda', () => {
    let emittedQuinzena: number | undefined;
    component.editIncome.subscribe(q => emittedQuinzena = q);

    const editIncomeBtn = fixture.nativeElement.querySelector('.edit-income-btn') as HTMLButtonElement;
    editIncomeBtn.click();

    expect(emittedQuinzena).toBe(1);
  });
});
