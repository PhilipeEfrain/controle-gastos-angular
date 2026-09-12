import { describe, it, expect, beforeEach } from 'vitest';
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

  describe('Cenários BDD (CARD-059): Monitoramento e Alertas de Vencimento na Linha da Despesa', () => {
    it('Cenário BDD 1: deve exibir badge de Vencida e classe is-overdue quando pendente e vencimento no passado', () => {
      // Data no passado
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const overdueExpense: Expense = {
        ...mockExpense,
        data_vencimento: pastDateStr,
        status_pagamento: false
      };

      fixture.componentRef.setInput('expense', overdueExpense);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.is-overdue')).toBeTruthy();
      expect(element.querySelector('.badge-overdue')).toBeTruthy();
      expect(element.textContent).toContain('Vencida');
    });

    it('Cenário BDD 2: deve exibir badge Vence Hoje quando a data for hoje', () => {
      const todayStr = new Date().toISOString().split('T')[0];

      const todayExpense: Expense = {
        ...mockExpense,
        data_vencimento: todayStr,
        status_pagamento: false
      };

      fixture.componentRef.setInput('expense', todayExpense);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.badge-due-today')).toBeTruthy();
      expect(element.textContent).toContain('Vence Hoje');
    });

    it('Cenário BDD 3: deve exibir badge Vence em Breve quando o vencimento for nos próximos 1 a 3 dias', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 2);
      const soonDateStr = soonDate.toISOString().split('T')[0];

      const dueSoonExpense: Expense = {
        ...mockExpense,
        data_vencimento: soonDateStr,
        status_pagamento: false
      };

      fixture.componentRef.setInput('expense', dueSoonExpense);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.badge-due-soon')).toBeTruthy();
      expect(element.textContent).toContain('Vence em');
    });

    it('Cenário BDD 4: despesa quitada (status_pagamento = true) NÃO deve exibir badge de alerta de atraso nem classe is-overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const paidExpense: Expense = {
        ...mockExpense,
        data_vencimento: pastDateStr,
        status_pagamento: true
      };

      fixture.componentRef.setInput('expense', paidExpense);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.badge-overdue')).toBeNull();
      expect(element.querySelector('.is-overdue')).toBeNull();
      expect(element.querySelector('.is-paid')).toBeTruthy();
    });
  });
});

