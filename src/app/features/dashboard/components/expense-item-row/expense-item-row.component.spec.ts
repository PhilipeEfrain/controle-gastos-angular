import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpenseItemRowComponent } from './expense-item-row.component';
import { Expense } from '../../../../core/models/finance.model';

describe('ExpenseItemRowComponent', () => {
  let component: ExpenseItemRowComponent;
  let fixture: ComponentFixture<ExpenseItemRowComponent>;

  const mockExpense: Expense = {
    id: 'exp-123',
    descricao: 'Supermercado Mensal',
    valor: 350.50,
    quinzena: 1,
    categoria: 'Alimentação',
    status_pagamento: false,
    codigo_comprovante: 'COMP-9988'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseItemRowComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseItemRowComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('expense', mockExpense);
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar a descrição e o valor formatado', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Supermercado Mensal');
    expect(compiled.textContent).toContain('350,50');
  });

  it('deve emitir togglePaid ao clicar no checkbox', () => {
    let emittedExpense: Expense | undefined;
    component.togglePaid.subscribe(exp => emittedExpense = exp);

    const checkbox = fixture.nativeElement.querySelector('.pay-checkbox') as HTMLButtonElement;
    checkbox.click();

    expect(emittedExpense).toEqual(mockExpense);
  });

  it('deve emitir edit e delete ao clicar nos respectivos botões', () => {
    let editExpense: Expense | undefined;
    let deleteExpense: Expense | undefined;

    component.edit.subscribe(exp => editExpense = exp);
    component.delete.subscribe(exp => deleteExpense = exp);

    const editBtn = fixture.nativeElement.querySelector('.edit-btn') as HTMLButtonElement;
    const deleteBtn = fixture.nativeElement.querySelector('.delete-btn') as HTMLButtonElement;

    editBtn.click();
    deleteBtn.click();

    expect(editExpense).toEqual(mockExpense);
    expect(deleteExpense).toEqual(mockExpense);
  });

  it('deve emitir updateReceipt ao clicar no badge de comprovante', () => {
    let receiptExpense: Expense | undefined;
    component.updateReceipt.subscribe(exp => receiptExpense = exp);

    const receiptBadge = fixture.nativeElement.querySelector('.receipt-badge') as HTMLButtonElement;
    receiptBadge.click();

    expect(receiptExpense).toEqual(mockExpense);
  });

  it('Cenário BDD: deve renderizar Renda Extra com badge específico e prefixo positivo (+)', () => {
    const mockIncome: Expense = {
      id: 'inc-999',
      descricao: 'Freelance Frontend',
      valor: 800.0,
      quinzena: 1,
      categoria: 'Freelance / Serviços',
      tipo: 'renda_extra',
      status_pagamento: false
    };

    fixture.componentRef.setInput('expense', mockIncome);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('+ Renda Extra');
    expect(compiled.textContent).toContain('+');
    expect(compiled.textContent).toContain('800,00');
    expect(compiled.querySelector('.is-income-row')).toBeTruthy();
  });
});
