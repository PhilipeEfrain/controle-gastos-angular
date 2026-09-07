import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Expense, MonthlyCycle, MonthBalanceSummary, AnnualTax } from '../models/finance.model';
import { calculateGlobalBalance, filterExpensesByFortnight, roundBRL } from '../utils/calculations';
import { getCurrentYearMonth, formatYearMonthLabel } from '../utils/date';
import { MonthlyCycleService } from '../services/monthly-cycle.service';
import { ExpenseService } from '../services/expense.service';
import { TaxService } from '../services/tax.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceStore {
  private cycleService = inject(MonthlyCycleService);
  private expenseService = inject(ExpenseService);
  private taxService = inject(TaxService);
  private destroyRef = inject(DestroyRef);

  // Subscriptions ativas
  private cycleSub?: Subscription;
  private expensesSub?: Subscription;
  private taxesSub?: Subscription;

  // Estados Reativos Privados (Signals)
  private readonly _selectedMonth = signal<string>(getCurrentYearMonth());
  private readonly _currentCycle = signal<MonthlyCycle | null>(null);
  private readonly _expenses = signal<Expense[]>([]);
  private readonly _taxes = signal<AnnualTax[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Seletores Públicos (ReadOnly Signals)
  readonly selectedMonth = this._selectedMonth.asReadonly();
  readonly currentCycle = this._currentCycle.asReadonly();
  readonly expenses = this._expenses.asReadonly();
  readonly taxes = this._taxes.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Valores Computados Derivados
  readonly selectedMonthLabel = computed(() =>
    formatYearMonthLabel(this._selectedMonth())
  );

  readonly q1Expenses = computed(() =>
    filterExpensesByFortnight(this._expenses(), 1)
  );

  readonly q2Expenses = computed(() =>
    filterExpensesByFortnight(this._expenses(), 2)
  );

  readonly balanceSummary = computed<MonthBalanceSummary>(() => {
    const cycle = this._currentCycle();
    const rendaQ1 = cycle?.renda_quinzena_1 ?? 0;
    const rendaQ2 = cycle?.renda_quinzena_2 ?? 0;
    return calculateGlobalBalance(rendaQ1, rendaQ2, this._expenses());
  });

  readonly totalTaxesBudget = computed(() => {
    return roundBRL(this._taxes().reduce((acc, curr) => acc + (curr.valor_orcado || 0), 0));
  });

  readonly totalTaxesPaid = computed(() => {
    return roundBRL(this._taxes().reduce((acc, curr) => acc + (curr.valor_pago || 0), 0));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cycleSub?.unsubscribe();
      this.expensesSub?.unsubscribe();
      this.taxesSub?.unsubscribe();
    });
  }

  // Ações de Mudança de Mês e Carregamento Reativo
  setSelectedMonth(month: string, userId?: string): void {
    this._selectedMonth.set(month);
    if (userId) {
      this.connectMonthStream(userId, month);
    }
  }

  /**
   * Conecta as streams em tempo real do Firestore para o mês selecionado
   */
  connectMonthStream(userId: string, mesAno: string): void {
    this._isLoading.set(true);
    this._error.set(null);

    // Cancela listeners anteriores
    this.cycleSub?.unsubscribe();
    this.expensesSub?.unsubscribe();

    this.cycleSub = this.cycleService.getCycleStream(userId, mesAno).subscribe({
      next: cycle => {
        this._currentCycle.set(cycle);
        this._isLoading.set(false);
      },
      error: err => {
        this._error.set(err.message || 'Erro ao carregar ciclo mensal');
        this._isLoading.set(false);
      }
    });

    this.expensesSub = this.expenseService.getExpensesStream(userId, mesAno).subscribe({
      next: expenses => {
        this._expenses.set(expenses);
        this._isLoading.set(false);
      },
      error: err => {
        this._error.set(err.message || 'Erro ao carregar despesas');
        this._isLoading.set(false);
      }
    });
  }

  /**
   * Conecta a stream de tributos anuais
   */
  connectTaxesStream(userId: string): void {
    this.taxesSub?.unsubscribe();
    this.taxesSub = this.taxService.getTaxesStream(userId).subscribe({
      next: taxes => {
        this._taxes.set(taxes);
      },
      error: err => {
        this._error.set(err.message || 'Erro ao carregar tributos');
      }
    });
  }

  // Mutadores diretos (úteis para testes unitários ou updates otimistas)
  setExpenses(expenses: Expense[]): void {
    this._expenses.set(expenses);
  }

  setCycle(cycle: MonthlyCycle | null): void {
    this._currentCycle.set(cycle);
  }

  setTaxes(taxes: AnnualTax[]): void {
    this._taxes.set(taxes);
  }

  /**
   * Reseta todo o estado financeiro e cancela subscrições ativas ao realizar logout
   */
  resetState(): void {
    this.cycleSub?.unsubscribe();
    this.expensesSub?.unsubscribe();
    this.taxesSub?.unsubscribe();

    this._currentCycle.set(null);
    this._expenses.set([]);
    this._taxes.set([]);
    this._isLoading.set(false);
    this._error.set(null);
  }
}
