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
import { Router, ActivatedRoute } from '@angular/router';
import { FinanceStore } from '../../core/state/finance.store';
import { AuthStore } from '../../core/state/auth.store';
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlyCycleService } from '../../core/services/monthly-cycle.service';
import { NotificationService } from '../../core/services/notification.service';
import { Expense, FortnightNumber, MonthlyCycle } from '../../core/models/finance.model';
import { formatBRL } from '../../core/utils/formatters';
import { addMonthsToYearMonth } from '../../core/utils/calculations';
import { getCurrentYearMonth, getMonthOffset, getExpenseDueDateInfo } from '../../core/utils/date';
import { PlanLimitsService } from '../../core/services/plan-limits.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { DuoService } from '../../core/services/duo.service';
import { DuoGroup, DuoSettlementSummary } from '../../core/models/duo.model';
import { DuoPairingModalComponent } from './components/duo-pairing-modal/duo-pairing-modal.component';
import { DuoSettlementCardComponent } from './components/duo-settlement-card/duo-settlement-card.component';
import { DuoSharedExpensesListComponent } from './components/duo-shared-expenses-list/duo-shared-expenses-list.component';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { DeficitAlertBannerComponent } from '../../shared/components/deficit-alert-banner/deficit-alert-banner.component';
import { DunningBannerComponent } from '../../shared/components/dunning-banner/dunning-banner.component';
import { FortnightCardComponent } from './components/fortnight-card/fortnight-card.component';
import { ExpenseFormModalComponent } from './components/expense-form-modal/expense-form-modal.component';
import { IncomeFormModalComponent } from './components/income-form-modal/income-form-modal.component';
import { ReceiptModalComponent } from './components/receipt-modal/receipt-modal.component';
import { CategoryDonutChartComponent } from './components/category-donut-chart/category-donut-chart.component';
import { MonthlyEvolutionChartComponent } from './components/monthly-evolution-chart/monthly-evolution-chart.component';
import { ExportModalComponent } from './components/export-modal/export-modal.component';
import { LimitReachedModalComponent } from '../../shared/components/limit-reached-modal/limit-reached-modal.component';
import { SubscriptionModalComponent } from '../../shared/components/subscription-modal/subscription-modal.component';
import { OnboardingChecklistComponent } from './components/onboarding-checklist/onboarding-checklist.component';
import { AdBannerComponent } from '../../shared/components/ad-banner/ad-banner.component';
import { CaixinhaModalComponent } from '../caixinha/caixinha-modal/caixinha-modal.component';
import { NavigationModalService } from '../../core/services/navigation-modal.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    DeficitAlertBannerComponent,
    DunningBannerComponent,
    FortnightCardComponent,
    ExpenseFormModalComponent,
    IncomeFormModalComponent,
    ReceiptModalComponent,
    CategoryDonutChartComponent,
    MonthlyEvolutionChartComponent,
    ExportModalComponent,
    LimitReachedModalComponent,
    SubscriptionModalComponent,
    DuoPairingModalComponent,
    DuoSettlementCardComponent,
    DuoSharedExpensesListComponent,
    OnboardingChecklistComponent,
    AdBannerComponent,
    CaixinhaModalComponent
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
  private readonly planLimitsService = inject(PlanLimitsService);
  private readonly duoService = inject(DuoService);
  private readonly notificationService = inject(NotificationService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly navModalService = inject(NavigationModalService);

  // Modo Casal / Duo State
  readonly duoGroup = signal<DuoGroup | null>(null);
  readonly isDuoPairingModalOpen = signal<boolean>(false);
  readonly initialDuoCode = signal<string>('');
  readonly activeDuoTab = signal<'meus' | 'nossos' | 'visao'>('meus');
  readonly isExpenseModalShared = signal<boolean>(false);
  readonly isCaixinhaModalOpen = signal<boolean>(false);

  readonly isDuoActive = computed(() => {
    return this.authStore.isDuo() || (this.duoGroup()?.status === 'active' && !!this.duoGroup()?.partnerId);
  });

  readonly isDuoPendingPairing = computed(() => {
    return this.authStore.isDuo() && (!this.duoGroup() || !this.duoGroup()?.partnerId);
  });

  readonly settlementSummary = computed<DuoSettlementSummary | null>(() => {
    const group = this.duoGroup();
    if (!group || group.status !== 'active' || !group.partnerId) return null;

    return this.duoService.calculateSettlement(
      this.financeStore.expenses(),
      group.ownerId,
      group.ownerName || 'Titular',
      group.partnerId,
      group.partnerName || 'Parceiro(a)'
    );
  });

  // Status visual para feedback temporário
  readonly actionMessage = signal<string | null>(null);
  readonly limitModalData = signal<{ title: string; message: string; resourceName: string } | null>(null);

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
  readonly isExpenseModalParcelado = signal<boolean>(false);

  readonly isIncomeModalOpen = signal<boolean>(false);

  readonly isReceiptModalOpen = signal<boolean>(false);
  readonly selectedExpenseForReceipt = signal<Expense | null>(null);

  readonly isExportModalOpen = signal<boolean>(false);
  readonly isSubscriptionModalOpen = signal<boolean>(false);

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

  readonly extraIncomeGlobalTooltip = computed(() => {
    const extra = this.financeStore.balanceSummary().totalExtraIncome;
    if (extra && extra > 0) {
      return `Saldo com acréscimo de renda extra (+ ${formatBRL(extra)})`;
    }
    return 'Saldo com acréscimo de renda extra';
  });

  readonly coverageStatusText = computed(() => {
    const summary = this.financeStore.balanceSummary();
    if (summary.temDeficitGlobal) {
      return 'Déficit no Mês';
    }
    if (summary.q1CobreQ2) {
      return 'Q2 Coberta pela Q1';
    }
    return 'Seu mês em equilíbrio';
  });

  // Rastreamento seguro de ciclos onde alertas de contas vencidas foram exibidos (CARD-059)
  private readonly trackedOverdueMonths = new Set<string>();

  constructor() {
    // Efeito reativo para recarregar dados do mês quando usuário ou mês selecionado mudar
    effect(() => {
      const user = this.authStore.currentUser();
      const month = this.financeStore.selectedMonth();
      if (user) {
        this.financeStore.connectMonthStream(user.uid, month);
      }
    });

    // Efeito isolado para tributos anuais (independente de selectedMonth)
    effect(() => {
      const user = this.authStore.currentUser();
      if (user) {
        this.financeStore.connectTaxesStream(user.uid);
      }
    });

    // Efeito reativo para despesas compartilhadas do Modo Casal (Duo)
    effect(() => {
      const user = this.authStore.currentUser();
      const group = this.duoGroup();
      const month = this.financeStore.selectedMonth();
      if (user && group && group.id && group.status === 'active' && group.partnerId) {
        this.financeStore.connectSharedExpensesStream(group.id, month);
      }
    });

    // Efeito reativo para rastrear exibição de alertas de contas vencidas (0 custo de Firestore)
    effect(() => {
      const expenses = this.financeStore.expenses();
      const month = this.financeStore.selectedMonth();
      if (!expenses || expenses.length === 0 || this.trackedOverdueMonths.has(month)) return;

      const overdueCount = expenses.filter(e => {
        if (e.status_pagamento || e.tipo === 'renda_extra' || !e.data_vencimento) return false;
        const info = getExpenseDueDateInfo(e.data_vencimento, e.status_pagamento, false);
        return info?.status === 'overdue';
      }).length;

      if (overdueCount > 0) {
        this.trackedOverdueMonths.add(month);
        this.analyticsService.trackEvent('overdue_expenses_alert_viewed', {
          month,
          overdue_count: overdueCount
        });
      }
    });

    // Sincronização com o NavigationModalService para acionamento global de modais (CARD-069)
    effect(() => {
      if (this.navModalService.isCaixinhaOpen()) {
        this.isCaixinhaModalOpen.set(true);
      }
    });

    effect(() => {
      if (this.navModalService.isExportOpen()) {
        this.isExportModalOpen.set(true);
      }
    });

    effect(() => {
      if (this.navModalService.isNewExpenseOpen()) {
        const q = this.navModalService.newExpenseQuinzena();
        this.openNewExpenseModal(q);
      }
    });
  }

  // Onboarding & Guia de Primeiro Acesso
  readonly isOnboardingDismissed = signal<boolean>(false);
  readonly hasExploredFeatures = signal<boolean>(false);

  readonly hasIncomes = computed<boolean>(() => {
    const cycle = this.financeStore.currentCycle();
    const q1 = Number(cycle?.renda_quinzena_1 || 0);
    const q2 = Number(cycle?.renda_quinzena_2 || 0);
    return q1 > 0 || q2 > 0;
  });

  readonly hasExpenses = computed<boolean>(() => {
    return this.financeStore.expenses().length > 0;
  });

  readonly showOnboardingChecklist = computed<boolean>(() => {
    return !this.isOnboardingDismissed();
  });

  onExploreFeaturesFromOnboarding(): void {
    this.hasExploredFeatures.set(true);
    try {
      const user = this.authStore.currentUser();
      if (user?.uid) {
        localStorage.setItem(`onboarding_explored_${user.uid}`, 'true');
      }
    } catch {
      // Ignora erro
    }
    this.goToInstallments();
  }

  onDismissOnboarding(): void {
    this.isOnboardingDismissed.set(true);
  }

  async ngOnInit(): Promise<void> {
    const user = this.authStore.currentUser();
    if (user) {
      try {
        let group = await this.duoService.getDuoGroupForUser(user.uid);
        if (!group && this.authStore.isDuo()) {
          group = await this.duoService.createOrGetDuoGroup(
            user.uid,
            user.email || '',
            user.displayName || 'Titular'
          );
        }
        this.duoGroup.set(group);
      } catch (e) {
        console.error('Erro ao buscar grupo Duo:', e);
      }

      try {
        const dismissed = localStorage.getItem(`onboarding_dismissed_${user.uid}`);
        if (dismissed === 'true') {
          this.isOnboardingDismissed.set(true);
        }
        const explored = localStorage.getItem(`onboarding_explored_${user.uid}`);
        if (explored === 'true') {
          this.hasExploredFeatures.set(true);
        }
      } catch {
        // Ignora erro
      }
    }

    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'new-installment') {
        this.openNewExpenseModal(1, true);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }

      if (params['action'] === 'caixinha') {
        this.isCaixinhaModalOpen.set(true);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }

      if (params['action'] === 'export') {
        this.isExportModalOpen.set(true);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }

      if (params['action'] === 'newExpense') {
        const q = Number(params['q']) === 2 ? 2 : 1;
        this.openNewExpenseModal(q as FortnightNumber);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }

      if (params['tab'] === 'nossos') {
        this.activeDuoTab.set('nossos');
      }

      const duoCode = params['duoCode'];
      if (duoCode && typeof duoCode === 'string') {
        const sanitized = duoCode.trim().toUpperCase();
        if (/^DUO-\d{4}$/i.test(sanitized)) {
          this.initialDuoCode.set(sanitized);
          this.isDuoPairingModalOpen.set(true);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
        }
      }
    });
  }

  // Validação Reativa de Janela de Histórico Deslizante
  readonly canGoPrevMonth = computed<boolean>(() => {
    const targetMonth = addMonthsToYearMonth(this.financeStore.selectedMonth(), -1);
    const offset = getMonthOffset(targetMonth, getCurrentYearMonth());
    return this.planLimitsService.isHistoryMonthAllowed(offset);
  });

  onExportUpgradeRequested(): void {
    this.limitModalData.set({
      title: 'Dossiê Anual das 24 Quinzenas',
      message: 'A compilação e exportação consolidada do Dossiê Anual em PDF com demonstrativo fiscal para IRPF é uma funcionalidade exclusiva dos planos Pro e Duo.',
      resourceName: 'Dossiê Anual Consolidado (PDF)'
    });
  }

  // Navegação Temporal de Meses
  prevMonth(): void {
    const newMonth = addMonthsToYearMonth(this.financeStore.selectedMonth(), -1);
    const offset = getMonthOffset(newMonth, getCurrentYearMonth());

    if (!this.planLimitsService.isHistoryMonthAllowed(offset)) {
      if (!this.authStore.isProOrDuo()) {
        this.limitModalData.set({
          title: 'Histórico Completo de 13 Meses',
          message: 'No plano Gratuito você tem acesso aos 2 meses mais recentes. Assine o Quinzena PRO para navegar por 13 meses móveis de histórico consolidado!',
          resourceName: 'Histórico de 13 Meses'
        });
      } else {
        this.notificationService.info('Você atingiu o limite da janela de 13 meses móveis do histórico.');
      }
      return;
    }

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
  openNewExpenseModal(quinzena: FortnightNumber = 1, isParcelado: boolean = false, isShared: boolean = false): void {
    this.expenseModalQuinzena.set(quinzena);
    this.expenseToEdit.set(null);
    this.isExpenseModalParcelado.set(isParcelado);
    this.isExpenseModalShared.set(isShared);
    this.isExpenseModalOpen.set(true);
  }

  openNewSharedExpenseModal(): void {
    this.openNewExpenseModal(1, false, true);
  }

  openEditExpenseModal(expense: Expense): void {
    this.expenseModalQuinzena.set(expense.quinzena);
    this.expenseToEdit.set(expense);
    this.isExpenseModalParcelado.set(false);
    this.isExpenseModalShared.set(false);
    this.isExpenseModalOpen.set(true);
  }

  async onToggleSharedPayment(event: { mesAno: string; id: string; status: boolean }): Promise<void> {
    const group = this.duoGroup();
    if (!group || !group.id) return;
    try {
      await this.duoService.toggleSharedExpensePaymentStatus(group.id, event.mesAno, event.id, event.status);
      this.notificationService.success(event.status ? 'Compra compartilhada marcada como quitada!' : 'Compra compartilhada reaberta');
    } catch (e: any) {
      this.actionMessage.set(e.message || 'Erro ao atualizar status da compra conjunta');
    }
  }

  async onDeleteSharedExpense(event: { mesAno: string; id: string }): Promise<void> {
    const group = this.duoGroup();
    if (!group || !group.id) return;
    try {
      await this.duoService.deleteSharedExpense(group.id, event.mesAno, event.id);
      this.notificationService.success('Compra compartilhada excluída com sucesso!');
    } catch (e: any) {
      this.actionMessage.set(e.message || 'Erro ao excluir compra compartilhada');
    }
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

  onExpenseModalClosed(): void {
    this.isExpenseModalOpen.set(false);
    this.navModalService.closeNewExpense();
  }

  onExportModalClosed(): void {
    this.isExportModalOpen.set(false);
    this.navModalService.closeExport();
  }

  onCaixinhaModalClosed(): void {
    this.isCaixinhaModalOpen.set(false);
    this.navModalService.closeCaixinha();
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

  openSubscriptionModal(): void {
    this.isSubscriptionModalOpen.set(true);
  }

  onSubscriptionSuccess(): void {
    this.isSubscriptionModalOpen.set(false);
    this.notificationService.success('Assinatura confirmada com sucesso! Seus recursos foram atualizados.');
  }

  async onDuoPairingModalClosed(): Promise<void> {
    this.isDuoPairingModalOpen.set(false);
    this.initialDuoCode.set('');
    const user = this.authStore.currentUser();
    if (user?.uid) {
      try {
        const group = await this.duoService.getDuoGroupForUser(user.uid);
        this.duoGroup.set(group);
      } catch (err) {
        console.error('Erro ao atualizar grupo Duo:', err);
      }
    }
  }

  onOpenDuoPairingFromSubscription(): void {
    this.isSubscriptionModalOpen.set(false);
    this.isDuoPairingModalOpen.set(true);
  }

  onCaixinhaMovementSuccess(): void {
    const user = this.authStore.currentUser();
    if (user?.uid) {
      this.financeStore.setSelectedMonth(this.financeStore.selectedMonth(), user.uid);
    }
  }

  async onLogout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigate(['/auth']);
  }
}
