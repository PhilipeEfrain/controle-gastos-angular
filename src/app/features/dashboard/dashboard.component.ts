import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  computed,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FinanceStore } from '../../core/state/finance.store';
import { AuthStore } from '../../core/state/auth.store';
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlyCycleService } from '../../core/services/monthly-cycle.service';
import { NotificationService } from '../../core/services/notification.service';
import { Expense, FortnightNumber, MonthlyCycle } from '../../core/models/finance.model';
import { formatBRL } from '../../core/utils/formatters';
import { addMonthsToYearMonth } from '../../core/utils/calculations';
import { getCurrentYearMonth } from '../../core/utils/date';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { BalanceBadgeComponent } from '../../shared/components/balance-badge/balance-badge.component';
import { DeficitAlertBannerComponent } from '../../shared/components/deficit-alert-banner/deficit-alert-banner.component';
import { FortnightCardComponent } from './components/fortnight-card/fortnight-card.component';
import { ExpenseFormModalComponent } from './components/expense-form-modal/expense-form-modal.component';
import { IncomeFormModalComponent } from './components/income-form-modal/income-form-modal.component';
import { ReceiptModalComponent } from './components/receipt-modal/receipt-modal.component';
import { CategoryDonutChartComponent } from './components/category-donut-chart/category-donut-chart.component';
import { MonthlyEvolutionChartComponent } from './components/monthly-evolution-chart/monthly-evolution-chart.component';
import { ExportModalComponent } from './components/export-modal/export-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    BalanceBadgeComponent,
    DeficitAlertBannerComponent,
    FortnightCardComponent,
    ExpenseFormModalComponent,
    IncomeFormModalComponent,
    ReceiptModalComponent,
    CategoryDonutChartComponent,
    MonthlyEvolutionChartComponent,
    ExportModalComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  readonly financeStore = inject(FinanceStore);
  readonly authStore = inject(AuthStore);
  private readonly expenseService = inject(ExpenseService);
  private readonly cycleService = inject(MonthlyCycleService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  // Status visual para feedback temporário
  readonly actionMessage = signal<string | null>(null);

  // Controle de Visualização de Gráficos Analíticos
  readonly showCharts = signal<boolean>(true);

  // Ciclos consolidados para evolução mensal
  readonly recentCycles = computed<MonthlyCycle[]>(() => {
    const current = this.financeStore.currentCycle();
    const selected = this.financeStore.selectedMonth();
    const summary = this.financeStore.balanceSummary();

    const activeCycle: MonthlyCycle = current ?? {
      mesAno: selected,
      renda_quinzena_1: summary.q1.renda,
      renda_quinzena_2: summary.q2.renda,
      total_renda: summary.totalRenda,
      total_gastos: summary.totalGastos,
      saldo_final: summary.saldoFinal,
    };

    return [activeCycle];
  });

  // Estados dos Modais
  readonly isExpenseModalOpen = signal<boolean>(false);
  readonly expenseModalQuinzena = signal<FortnightNumber>(1);
  readonly expenseToEdit = signal<Expense | null>(null);

  readonly isIncomeModalOpen = signal<boolean>(false);

  readonly isReceiptModalOpen = signal<boolean>(false);
  readonly selectedExpenseForReceipt = signal<Expense | null>(null);

  readonly isExportModalOpen = signal<boolean>(false);

  // Formatações computadas para os Top Cards
  readonly formattedTotalRenda = computed(() =>
    formatBRL(this.financeStore.balanceSummary().totalRenda)
  );

  readonly formattedTotalGastos = computed(() =>
    formatBRL(this.financeStore.balanceSummary().totalGastos)
  );

  readonly formattedSaldoGlobal = computed(() =>
    formatBRL(this.financeStore.balanceSummary().saldoFinal)
  );

  readonly coverageStatusText = computed(() => {
    const summary = this.financeStore.balanceSummary();
    if (summary.temDeficitGlobal) {
      return 'Déficit no Mês';
    }
    if (summary.q1CobreQ2) {
      return 'Q2 Coberta pela Q1';
    }
    return 'Superavitário';
  });

  constructor() {
    // Efeito reativo para recarregar dados quando usuário autenticado estiver pronto
    effect(() => {
      const user = this.authStore.currentUser();
      const month = this.financeStore.selectedMonth();
      if (user) {
        this.financeStore.connectMonthStream(user.uid, month);
        this.financeStore.connectTaxesStream(user.uid);
      }
    });
  }

  ngOnInit(): void {
    const user = this.authStore.currentUser();
    if (user) {
      this.financeStore.connectMonthStream(user.uid, this.financeStore.selectedMonth());
    }
  }

  // Navegação Temporal de Meses
  prevMonth(): void {
    const newMonth = addMonthsToYearMonth(this.financeStore.selectedMonth(), -1);
    this.updateSelectedMonth(newMonth);
  }

  nextMonth(): void {
    const newMonth = addMonthsToYearMonth(this.financeStore.selectedMonth(), 1);
    this.updateSelectedMonth(newMonth);
  }

  goToCurrentMonth(): void {
    const current = getCurrentYearMonth();
    this.updateSelectedMonth(current);
  }

  private updateSelectedMonth(month: string): void {
    const user = this.authStore.currentUser();
    this.financeStore.setSelectedMonth(month, user?.uid);
  }

  // Abertura de Modais
  openNewExpenseModal(quinzena: FortnightNumber): void {
    this.expenseModalQuinzena.set(quinzena);
    this.expenseToEdit.set(null);
    this.isExpenseModalOpen.set(true);
  }

  openEditExpenseModal(expense: Expense): void {
    this.expenseModalQuinzena.set(expense.quinzena);
    this.expenseToEdit.set(expense);
    this.isExpenseModalOpen.set(true);
  }

  openIncomeModal(): void {
    this.isIncomeModalOpen.set(true);
  }

  openReceiptModal(expense: Expense): void {
    this.selectedExpenseForReceipt.set(expense);
    this.isReceiptModalOpen.set(true);
  }

  openExportModal(): void {
    this.isExportModalOpen.set(true);
  }

  onExpenseSaved(): void {
    this.notificationService.success('Despesa registrada com sucesso!');
  }

  onIncomeSaved(): void {
    this.notificationService.success('Rendas do ciclo salvas com sucesso!');
  }

  onReceiptSaved(): void {
    this.notificationService.success('Comprovante bancário vinculado com sucesso!');
  }

  // Ações Diretas de Despesas
  async onTogglePaid(expense: Expense): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !expense.id) return;

    try {
      await this.expenseService.togglePaymentStatus(
        user.uid,
        this.financeStore.selectedMonth(),
        expense.id,
        expense.status_pagamento
      );
      const novoStatus = !expense.status_pagamento ? 'paga' : 'pendente';
      this.notificationService.info(`Despesa marcada como ${novoStatus}.`);
    } catch (err: any) {
      this.notificationService.error('Erro ao atualizar status: ' + err.message);
    }
  }

  async onDeleteExpense(expense: Expense): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !expense.id) return;

    const confirm = window.confirm(`Deseja realmente excluir "${expense.descricao}"?`);
    if (!confirm) return;

    try {
      await this.expenseService.deleteExpense(
        user.uid,
        this.financeStore.selectedMonth(),
        expense.id
      );
      this.notificationService.success(`Despesa "${expense.descricao}" excluída com sucesso.`);
    } catch (err: any) {
      this.notificationService.error('Erro ao excluir despesa: ' + err.message);
    }
  }

  goToTaxes(): void {
    this.router.navigate(['/tributos']);
  }

  goToTravel(): void {
    this.router.navigate(['/viagens']);
  }

  goToInstallments(): void {
    this.router.navigate(['/parcelamentos']);
  }

  async onLogout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigate(['/auth']);
  }
}
