import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Expense, MonthlyCycle, MonthBalanceSummary, AnnualTax } from '../models/finance.model';
import { DuoSharedExpense } from '../models/duo.model';
import { calculateGlobalBalance, filterExpensesByFortnight, roundBRL } from '../utils/calculations';
import { getCurrentYearMonth, formatYearMonthLabel } from '../utils/date';
import { MonthlyCycleService } from '../services/monthly-cycle.service';
import { ExpenseService } from '../services/expense.service';
import { TaxService } from '../services/tax.service';
import { DuoService } from '../services/duo.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceStore {
  private cycleService = inject(MonthlyCycleService);
  private expenseService = inject(ExpenseService);
  private taxService = inject(TaxService);
  private duoService = inject(DuoService, { optional: true });
  private destroyRef = inject(DestroyRef);

  // Subscriptions ativas
  private cycleSub?: Subscription;
  private expensesSub?: Subscription;
  private taxesSub?: Subscription;
  private sharedExpensesSub?: Subscription;

  // Cache em memória de meses já sincronizados com despesas recorrentes (evita leituras redundantes no Firestore)
  private readonly syncedMonths = new Set<string>();

  // Estados Reativos Privados (Signals)
  private readonly _selectedMonth = signal<string>(getCurrentYearMonth());
  private readonly _currentCycle = signal<MonthlyCycle | null>(null);
  private readonly _expenses = signal<Expense[]>([]);
  private readonly _sharedExpenses = signal<DuoSharedExpense[]>([]);
  private readonly _taxes = signal<AnnualTax[]>([]);
  private readonly _currentUserId = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Seletores Públicos (ReadOnly Signals)
  readonly selectedMonth = this._selectedMonth.asReadonly();
  readonly currentCycle = this._currentCycle.asReadonly();
  readonly personalExpenses = this._expenses.asReadonly();
  readonly sharedExpenses = this._sharedExpenses.asReadonly();
  readonly taxes = this._taxes.asReadonly();
  readonly currentUserId = this._currentUserId.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // Lista unificada de despesas do usuário (Pessoais + Cota-parte em despesas do casal)
  readonly expenses = computed<Expense[]>(() => {
    const personal = this._expenses();
    const shared = this._sharedExpenses();
    const currentUid = this._currentUserId();

    if (!shared || shared.length === 0 || !currentUid) {
      return personal;
    }

    const sharedAsPersonal: Expense[] = [];

    for (const s of shared) {
      // Determina se o usuário logado é o titular (primeiro membro) ou o parceiro
      const isOwner = s.members && s.members[0] === currentUid;
      const userShare = isOwner ? (s.valorOwner ?? 0) : (s.valorPartner ?? 0);

      if (userShare > 0) {
        sharedAsPersonal.push({
          id: `shared_${s.id}`,
          descricao: s.descricao,
          valor: userShare,
          categoria: s.categoria || 'Casal',
          quinzena: s.quinzena,
          status_pagamento: !!s.status_pagamento,
          tipo: 'despesa',
          data_vencimento: s.data_vencimento,
          codigo_comprovante: s.codigoComprovante || undefined,
          parcela_atual: s.parcelaAtual,
          total_parcelas: s.totalParcelas,
          isShared: true,
          sharedExpenseId: s.id,
          sharedTotal: s.valorTotal,
          pagoPorNome: s.pagoPorNome,
          createdAt: s.createdAt
        });
      }
    }

    return [...personal, ...sharedAsPersonal];
  });

  // Valores Computados Derivados
  readonly selectedMonthLabel = computed(() =>
    formatYearMonthLabel(this._selectedMonth())
  );

  readonly q1Expenses = computed(() =>
    filterExpensesByFortnight(this.expenses(), 1)
  );

  readonly q2Expenses = computed(() =>
    filterExpensesByFortnight(this.expenses(), 2)
  );

  readonly balanceSummary = computed<MonthBalanceSummary>(() => {
    const cycle = this._currentCycle();
    const rendaQ1 = cycle?.renda_quinzena_1 ?? 0;
    const rendaQ2 = cycle?.renda_quinzena_2 ?? 0;
    return calculateGlobalBalance(rendaQ1, rendaQ2, this.expenses());
  });

  readonly totalTaxesBudget = computed(() => {
    return roundBRL(this._taxes().reduce((acc, curr) => acc + (curr.valor_orcado || 0), 0));
  });

  readonly totalTaxesPaid = computed(() => {
    return roundBRL(this._taxes().reduce((acc, curr) => acc + (curr.valor_pago || 0), 0));
  });

  readonly totalSharedExpenses = computed(() => {
    return roundBRL(this._sharedExpenses().reduce((acc, curr) => acc + (curr.valorTotal || 0), 0));
  });

  readonly totalSharedOwner = computed(() => {
    return roundBRL(this._sharedExpenses().reduce((acc, curr) => acc + (curr.valorOwner || 0), 0));
  });

  readonly totalSharedPartner = computed(() => {
    return roundBRL(this._sharedExpenses().reduce((acc, curr) => acc + (curr.valorPartner || 0), 0));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cycleSub?.unsubscribe();
      this.expensesSub?.unsubscribe();
      this.taxesSub?.unsubscribe();
      this.sharedExpensesSub?.unsubscribe();
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
    this._currentUserId.set(userId);
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
        // Sincroniza despesas recorrentes ativas apenas 1x por mês carregado (evita leituras contínuas a cada snapshot)
        if (!this.syncedMonths.has(mesAno)) {
          this.syncedMonths.add(mesAno);
          this.expenseService.syncRecurringExpensesForMonth(userId, mesAno, expenses).catch(() => {
            // Em caso de falha de rede/permissão, desmarca para permitir nova tentativa futura
            this.syncedMonths.delete(mesAno);
          });
        }
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
  setCurrentUserId(userId: string): void {
    this._currentUserId.set(userId);
  }

  setExpenses(expenses: Expense[]): void {
    this._expenses.set(expenses);
  }

  setCycle(cycle: MonthlyCycle | null): void {
    this._currentCycle.set(cycle);
  }

  setTaxes(taxes: AnnualTax[]): void {
    this._taxes.set(taxes);
  }

  setSharedExpenses(shared: DuoSharedExpense[]): void {
    this._sharedExpenses.set(shared);
  }

  /**
   * Conecta a stream reativa de despesas compartilhadas do grupo Duo
   */
  connectSharedExpensesStream(groupId: string, mesAno: string, userId?: string): void {
    if (userId) {
      this._currentUserId.set(userId);
    }
    this.sharedExpensesSub?.unsubscribe();
    if (!this.duoService || !groupId) {
      this._sharedExpenses.set([]);
      return;
    }

    const effectiveUid = userId || this._currentUserId();
    this.sharedExpensesSub = this.duoService.getSharedExpensesStream(groupId, mesAno, effectiveUid).subscribe({
      next: shared => {
        this._sharedExpenses.set(shared);
      },
      error: (err) => {
        console.error('[FinanceStore] Erro ao carregar despesas compartilhadas:', err);
        this._sharedExpenses.set([]);
      }
    });
  }

  /**
   * Invalida o cache de sincronização de despesas recorrentes para um mês específico ou todos
   */
  invalidateRecurrenceCache(mesAno?: string): void {
    if (mesAno) {
      this.syncedMonths.delete(mesAno);
    } else {
      this.syncedMonths.clear();
    }
  }

  /**
   * Reseta todo o estado financeiro e cancela subscrições ativas ao realizar logout
   */
  resetState(): void {
    this.cycleSub?.unsubscribe();
    this.expensesSub?.unsubscribe();
    this.taxesSub?.unsubscribe();
    this.sharedExpensesSub?.unsubscribe();

    this.syncedMonths.clear();
    this._currentUserId.set('');
    this._currentCycle.set(null);
    this._expenses.set([]);
    this._sharedExpenses.set([]);
    this._taxes.set([]);
    this._isLoading.set(false);
    this._error.set(null);
  }
}
