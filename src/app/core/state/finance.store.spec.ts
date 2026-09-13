import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { FinanceStore } from './finance.store';
import { MonthlyCycleService } from '../services/monthly-cycle.service';
import { ExpenseService } from '../services/expense.service';
import { TaxService } from '../services/tax.service';
import { DuoService } from '../services/duo.service';
import { Expense, MonthlyCycle, AnnualTax } from '../models/finance.model';

describe('FinanceStore (Signals Reactive State)', () => {
  let store: FinanceStore;
  let mockCycleService: any;
  let mockExpenseService: any;
  let mockTaxService: any;
  let mockDuoService: any;

  beforeEach(() => {
    mockCycleService = {
      getCycleStream: vi.fn(() => of(null))
    };
    mockExpenseService = {
      getExpensesStream: vi.fn(() => of([])),
      syncRecurringExpensesForMonth: vi.fn().mockResolvedValue(undefined)
    };
    mockTaxService = {
      getTaxesStream: vi.fn(() => of([]))
    };
    mockDuoService = {
      getSharedExpensesStream: vi.fn(() => of([]))
    };

    TestBed.configureTestingModule({
      providers: [
        FinanceStore,
        { provide: MonthlyCycleService, useValue: mockCycleService },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: TaxService, useValue: mockTaxService },
        { provide: DuoService, useValue: mockDuoService }
      ]
    });

    store = TestBed.inject(FinanceStore);
  });

  it('deve inicializar com o mês corrente e lista vazia', () => {
    expect(store.selectedMonth()).toBeTruthy();
    expect(store.expenses()).toEqual([]);
    expect(store.currentCycle()).toBeNull();
  });

  it('Cenário BDD: deve filtrar despesas reativamente por quinzena nos computed signals', () => {
    const expenses: Expense[] = [
      { id: '1', descricao: 'Aluguel', valor: 1500, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
      { id: '2', descricao: 'Cartão', valor: 800, quinzena: 2, status_pagamento: false, categoria: 'Cartão' },
      { id: '3', descricao: 'Condomínio', valor: 400, quinzena: 1, status_pagamento: true, categoria: 'Moradia' }
    ];

    store.setExpenses(expenses);

    expect(store.q1Expenses().length).toBe(2);
    expect(store.q2Expenses().length).toBe(1);
    expect(store.q2Expenses()[0].descricao).toBe('Cartão');
  });

  it('Cenário BDD: deve recalcular automaticamente o balanceSummary quando ciclo e despesas mudam', () => {
    const cycle: MonthlyCycle = {
      mesAno: '2025-03',
      renda_quinzena_1: 2500,
      renda_quinzena_2: 2000,
      total_renda: 4500,
      total_gastos: 0,
      saldo_final: 4500
    };

    const expenses: Expense[] = [
      { descricao: 'Casa', valor: 2000, quinzena: 1, status_pagamento: true, categoria: 'Moradia' },
      { descricao: 'Fatura', valor: 1500, quinzena: 2, status_pagamento: false, categoria: 'Cartão' }
    ];

    store.setCycle(cycle);
    store.setExpenses(expenses);

    const balance = store.balanceSummary();
    expect(balance.totalRenda).toBe(4500);
    expect(balance.totalGastos).toBe(3500);
    expect(balance.saldoFinal).toBe(1000);
    expect(balance.q1.saldo).toBe(500);
    expect(balance.q2.saldo).toBe(500);
    expect(balance.temDeficitGlobal).toBe(false);
  });

  it('deve calcular totais orçado e pago de tributos nos computed signals', () => {
    const taxes: AnnualTax[] = [
      { titulo: 'IPTU', data_vencimento: '2025-04-10', valor_orcado: 1200, valor_pago: 1150, status: 'Pago' },
      { titulo: 'IPVA', data_vencimento: '2025-02-15', valor_orcado: 800, valor_pago: 0, status: 'Pendente' }
    ];

    store.setTaxes(taxes);

    expect(store.totalTaxesBudget()).toBe(2000);
    expect(store.totalTaxesPaid()).toBe(1150);
  });

  it('Cenário BDD: deve resetar todo o estado e limpar streams ao invocar resetState()', () => {
    store.setCycle({
      mesAno: '2026-09',
      renda_quinzena_1: 3000,
      renda_quinzena_2: 3000,
      total_renda: 6000,
      total_gastos: 1000,
      saldo_final: 5000
    });
    store.setExpenses([{ id: '1', descricao: 'Aluguel', valor: 1000, quinzena: 1, status_pagamento: true, categoria: 'Moradia' }]);
    store.setTaxes([{ titulo: 'IPTU', data_vencimento: '2026-04-10', valor_orcado: 1200, valor_pago: 0, status: 'Pendente' }]);

    expect(store.currentCycle()).not.toBeNull();
    expect(store.expenses().length).toBe(1);
    expect(store.taxes().length).toBe(1);

    store.resetState();

    expect(store.currentCycle()).toBeNull();
    expect(store.expenses()).toEqual([]);
    expect(store.taxes()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('Cenário BDD CARD-064: deve sincronizar despesas recorrentes apenas 1 vez por mês carregado, evitando chamadas repetidas', () => {
    const expensesSubject = new Subject<Expense[]>();
    mockExpenseService.getExpensesStream = vi.fn(() => expensesSubject.asObservable());

    store.connectMonthStream('user-1', '2026-09');

    // Primeira emissão (carregamento inicial)
    expensesSubject.next([]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(1);

    // Segunda emissão (ex: usuário marcou despesa como paga)
    expensesSubject.next([{ id: 'exp-1', descricao: 'Internet', valor: 100, quinzena: 1, categoria: 'Contas', status_pagamento: true }]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(1);

    // Terceira emissão (ex: usuário alterou comprovante)
    expensesSubject.next([{ id: 'exp-1', descricao: 'Internet', valor: 100, quinzena: 1, categoria: 'Contas', status_pagamento: true, codigo_comprovante: 'COMP123' }]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(1);
  });

  it('Cenário BDD CARD-064: deve sincronizar novamente para um mês diferente ou após resetState()', () => {
    const expensesSubject = new Subject<Expense[]>();
    mockExpenseService.getExpensesStream = vi.fn(() => expensesSubject.asObservable());

    store.connectMonthStream('user-1', '2026-09');
    expensesSubject.next([]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(1);

    // Conecta para mês subsequente 2026-10
    store.connectMonthStream('user-1', '2026-10');
    expensesSubject.next([]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(2);

    // Reseta estado (logout) e reconecta ao mês anterior 2026-09
    store.resetState();
    store.connectMonthStream('user-1', '2026-09');
    expensesSubject.next([]);
    expect(mockExpenseService.syncRecurringExpensesForMonth).toHaveBeenCalledTimes(3);
  });

  it('Cenário BDD CARD-070: deve unificar reativamente a cota-parte de despesas compartilhadas em expenses e q1Expenses para o titular', () => {
    store.setCurrentUserId('owner-1');
    store.setExpenses([
      { id: 'p1', descricao: 'Almoço individual', valor: 50, quinzena: 1, status_pagamento: true, categoria: 'Alimentação' }
    ]);

    store.setSharedExpenses([
      {
        id: 's1',
        descricao: 'Geladeira Nova',
        valorTotal: 2000,
        valorOwner: 1000,
        valorPartner: 1000,
        pagoPorId: 'owner-1',
        pagoPorNome: 'Titular',
        quinzena: 1,
        mesAno: '2026-09',
        tipoDivisao: '50_50',
        members: ['owner-1', 'partner-2']
      }
    ]);

    const allExp = store.expenses();
    expect(allExp.length).toBe(2);

    const sharedProjected = allExp.find(e => e.id === 'shared_s1');
    expect(sharedProjected).toBeDefined();
    expect(sharedProjected?.valor).toBe(1000);
    expect(sharedProjected?.isShared).toBe(true);
    expect(sharedProjected?.quinzena).toBe(1);

    expect(store.q1Expenses().length).toBe(2);
  });

  it('Cenário BDD CARD-070: deve projetar a cota-parte correta para o parceiro quando este for o usuário atual', () => {
    store.setCurrentUserId('partner-2');
    store.setExpenses([]);

    store.setSharedExpenses([
      {
        id: 's1',
        descricao: 'Fogão',
        valorTotal: 1200,
        valorOwner: 800,
        valorPartner: 400,
        pagoPorId: 'owner-1',
        pagoPorNome: 'Titular',
        quinzena: 2,
        mesAno: '2026-09',
        tipoDivisao: 'personalizado',
        members: ['owner-1', 'partner-2']
      }
    ]);

    const allExp = store.expenses();
    expect(allExp.length).toBe(1);

    const sharedProjected = allExp[0];
    expect(sharedProjected.valor).toBe(400); // Cota-parte do parceiro
    expect(sharedProjected.isShared).toBe(true);
    expect(store.q2Expenses().length).toBe(1);
    expect(store.q1Expenses().length).toBe(0);
  });

  it('Cenário BDD CARD-070: deve abater a cota-parte compartilhada do saldo no balanceSummary', () => {
    store.setCurrentUserId('owner-1');
    store.setCycle({
      mesAno: '2026-09',
      renda_quinzena_1: 3000,
      renda_quinzena_2: 3000,
      total_renda: 6000,
      total_gastos: 0,
      saldo_final: 6000
    });

    store.setExpenses([
      { id: 'p1', descricao: 'Internet', valor: 200, quinzena: 1, status_pagamento: true, categoria: 'Contas' }
    ]);

    store.setSharedExpenses([
      {
        id: 's1',
        descricao: 'Mercado Mensal',
        valorTotal: 1000,
        valorOwner: 500,
        valorPartner: 500,
        pagoPorId: 'owner-1',
        pagoPorNome: 'Titular',
        quinzena: 1,
        mesAno: '2026-09',
        tipoDivisao: '50_50',
        members: ['owner-1', 'partner-2']
      }
    ]);

    const balance = store.balanceSummary();
    // Gastos Q1: 200 (individual) + 500 (cota de mercado) = 700
    expect(balance.q1.totalGastos).toBe(700);
    expect(balance.q1.saldo).toBe(2300);
    expect(balance.totalGastos).toBe(700);
    expect(balance.saldoFinal).toBe(5300);
  });
});
