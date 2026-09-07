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
import { Expense, FortnightNumber } from '../../core/models/finance.model';
import { formatBRL } from '../../core/utils/formatters';
import { addMonthsToYearMonth } from '../../core/utils/calculations';
import { getCurrentYearMonth } from '../../core/utils/date';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { BalanceBadgeComponent } from '../../shared/components/balance-badge/balance-badge.component';
import { DeficitAlertBannerComponent } from '../../shared/components/deficit-alert-banner/deficit-alert-banner.component';
import { FortnightCardComponent } from './components/fortnight-card/fortnight-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    BalanceBadgeComponent,
    DeficitAlertBannerComponent,
    FortnightCardComponent
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
  private readonly router = inject(Router);

  // Status visual para feedback temporário
  readonly actionMessage = signal<string | null>(null);

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

  // Ações de Despesas
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
    } catch (err: any) {
      this.actionMessage.set('Erro ao atualizar status da despesa: ' + err.message);
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
      this.actionMessage.set(`Despesa "${expense.descricao}" excluída com sucesso.`);
      setTimeout(() => this.actionMessage.set(null), 3000);
    } catch (err: any) {
      this.actionMessage.set('Erro ao excluir despesa: ' + err.message);
    }
  }

  async onAddExpenseQuick(quinzena: FortnightNumber): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user) return;

    const descricao = window.prompt(`[Quinzena ${quinzena}] Descrição da despesa:`);
    if (!descricao || !descricao.trim()) return;

    const valorStr = window.prompt('Valor da despesa em R$ (ex: 150,00):');
    if (!valorStr) return;

    const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Valor inválido!');
      return;
    }

    const categoria = window.prompt('Categoria (ex: Alimentação, Moradia, Transporte):') || 'Geral';

    try {
      await this.expenseService.addExpense(user.uid, this.financeStore.selectedMonth(), {
        descricao: descricao.trim(),
        valor,
        quinzena,
        categoria: categoria.trim(),
        status_pagamento: false
      });
      this.actionMessage.set('Despesa adicionada com sucesso!');
      setTimeout(() => this.actionMessage.set(null), 3000);
    } catch (err: any) {
      this.actionMessage.set('Erro ao criar despesa: ' + err.message);
    }
  }

  async onEditIncomeQuick(quinzena: FortnightNumber): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user) return;

    const cycle = this.financeStore.currentCycle();
    const currentQ1 = cycle?.renda_quinzena_1 ?? 0;
    const currentQ2 = cycle?.renda_quinzena_2 ?? 0;

    const valorStr = window.prompt(
      `Definir Renda da Quinzena ${quinzena} (${quinzena === 1 ? 'Dia 31' : 'Dia 15'}) em R$:`,
      (quinzena === 1 ? currentQ1 : currentQ2).toString()
    );

    if (valorStr === null) return;

    const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
    if (isNaN(valor) || valor < 0) {
      alert('Valor de renda inválido!');
      return;
    }

    try {
      const newQ1 = quinzena === 1 ? valor : currentQ1;
      const newQ2 = quinzena === 2 ? valor : currentQ2;

      await this.cycleService.saveIncome(user.uid, this.financeStore.selectedMonth(), newQ1, newQ2);
      this.actionMessage.set(`Renda da Quinzena ${quinzena} atualizada!`);
      setTimeout(() => this.actionMessage.set(null), 3000);
    } catch (err: any) {
      this.actionMessage.set('Erro ao atualizar renda: ' + err.message);
    }
  }

  async onUpdateReceiptQuick(expense: Expense): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !expense.id) return;

    const codigo = window.prompt(
      `Código de comprovante para "${expense.descricao}":`,
      expense.codigo_comprovante || ''
    );

    if (codigo === null) return;

    try {
      await this.expenseService.updateReceiptCode(
        user.uid,
        this.financeStore.selectedMonth(),
        expense.id,
        codigo
      );
      this.actionMessage.set('Comprovante atualizado!');
      setTimeout(() => this.actionMessage.set(null), 3000);
    } catch (err: any) {
      this.actionMessage.set('Erro ao salvar comprovante: ' + err.message);
    }
  }

  async onLogout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigate(['/auth']);
  }
}
