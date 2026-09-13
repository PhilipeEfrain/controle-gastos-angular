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
import { TaxService } from '../../core/services/tax.service';
import { NotificationService } from '../../core/services/notification.service';
import { AnnualTax } from '../../core/models/finance.model';
import { PlanLimitsService } from '../../core/services/plan-limits.service';
import { formatBRL } from '../../core/utils/formatters';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { TaxComparisonCardComponent } from './components/tax-comparison-card/tax-comparison-card.component';
import { TaxFormModalComponent } from './components/tax-form-modal/tax-form-modal.component';
import { LimitReachedModalComponent } from '../../shared/components/limit-reached-modal/limit-reached-modal.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-taxes',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    TaxComparisonCardComponent,
    TaxFormModalComponent,
    LimitReachedModalComponent,
    ConfirmationModalComponent
  ],
  templateUrl: './taxes.component.html',
  styleUrls: ['./taxes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxesComponent implements OnInit {
  readonly financeStore = inject(FinanceStore);
  readonly authStore = inject(AuthStore);
  private readonly taxService = inject(TaxService);
  private readonly planLimitsService = inject(PlanLimitsService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly isTaxModalOpen = signal<boolean>(false);
  readonly isLimitModalOpen = signal<boolean>(false);
  readonly limitModalMessage = signal<string>('');
  readonly taxToEdit = signal<AnnualTax | null>(null);
  readonly statusFilter = signal<'Todos' | 'Pendente' | 'Pago'>('Todos');
  readonly actionMessage = signal<string | null>(null);
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly taxToDelete = signal<AnnualTax | null>(null);
  readonly deleteModalMessage = computed(() => {
    const tax = this.taxToDelete();
    return `Deseja realmente excluir o tributo "${tax?.titulo || ''}"?`;
  });

  readonly filteredTaxes = computed(() => {
    const all = this.financeStore.taxes();
    const filter = this.statusFilter();
    if (filter === 'Todos') {
      return all;
    }
    return all.filter(t => t.status === filter);
  });

  readonly paidCount = computed(() => {
    return this.financeStore.taxes().filter(t => t.status === 'Pago').length;
  });

  readonly totalCount = computed(() => {
    return this.financeStore.taxes().length;
  });

  constructor() {
    effect(() => {
      const user = this.authStore.currentUser();
      if (user) {
        this.financeStore.connectTaxesStream(user.uid);
      }
    });
  }

  ngOnInit(): void {
    // A subscrição reativa aos tributos é gerenciada pelo effect() no construtor
  }

  setFilter(filter: 'Todos' | 'Pendente' | 'Pago'): void {
    this.statusFilter.set(filter);
  }

  openNewTaxModal(): void {
    const limitCheck = this.planLimitsService.checkTaxLimit(this.totalCount());
    if (!limitCheck.allowed) {
      this.limitModalMessage.set(limitCheck.limitMessage);
      this.isLimitModalOpen.set(true);
      return;
    }
    this.taxToEdit.set(null);
    this.isTaxModalOpen.set(true);
  }

  openEditTaxModal(tax: AnnualTax): void {
    this.taxToEdit.set(tax);
    this.isTaxModalOpen.set(true);
  }

  onTaxSaved(): void {
    this.notificationService.success('Tributo anual salvo com sucesso!');
  }

  async onQuickPay(tax: AnnualTax): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !tax.id) return;

    const valorStr = window.prompt(
      `Informar valor pago para "${tax.titulo}" em R$:`,
      tax.valor_orcado.toString()
    );

    if (valorStr === null) return;

    const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
    if (isNaN(valor) || valor < 0) {
      this.notificationService.error('Valor de liquidação inválido!');
      return;
    }

    try {
      await this.taxService.markAsPaid(user.uid, tax.id, valor);
      this.notificationService.success(`Tributo "${tax.titulo}" liquidado com sucesso!`);
    } catch (err: any) {
      this.notificationService.error('Erro ao liquidar tributo: ' + err.message);
    }
  }

  onDeleteTax(tax: AnnualTax): void {
    if (!tax.id) return;
    this.taxToDelete.set(tax);
    this.isDeleteModalOpen.set(true);
  }

  cancelDeleteTax(): void {
    this.isDeleteModalOpen.set(false);
    this.taxToDelete.set(null);
  }

  async confirmDeleteTax(): Promise<void> {
    const user = this.authStore.currentUser();
    const tax = this.taxToDelete();
    if (!user || !tax?.id) {
      this.isDeleteModalOpen.set(false);
      return;
    }

    this.isDeleteModalOpen.set(false);
    try {
      await this.taxService.deleteTax(user.uid, tax.id);
      this.notificationService.success(`Tributo "${tax.titulo}" excluído.`);
    } catch (err: any) {
      this.notificationService.error('Erro ao excluir tributo: ' + err.message);
    } finally {
      this.taxToDelete.set(null);
    }
  }

  formatAmount(val: number | undefined): string {
    return formatBRL(val ?? 0);
  }

  private showFeedback(msg: string): void {
    this.actionMessage.set(msg);
    setTimeout(() => this.actionMessage.set(null), 3000);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  async onLogout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigate(['/auth']);
  }
}
