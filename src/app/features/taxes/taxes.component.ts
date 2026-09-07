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
import { formatBRL } from '../../core/utils/formatters';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { TaxComparisonCardComponent } from './components/tax-comparison-card/tax-comparison-card.component';
import { TaxFormModalComponent } from './components/tax-form-modal/tax-form-modal.component';

@Component({
  selector: 'app-taxes',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    TaxComparisonCardComponent,
    TaxFormModalComponent
  ],
  templateUrl: './taxes.component.html',
  styleUrls: ['./taxes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxesComponent implements OnInit {
  readonly financeStore = inject(FinanceStore);
  readonly authStore = inject(AuthStore);
  private readonly taxService = inject(TaxService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly isTaxModalOpen = signal<boolean>(false);
  readonly taxToEdit = signal<AnnualTax | null>(null);
  readonly statusFilter = signal<'Todos' | 'Pendente' | 'Pago'>('Todos');
  readonly actionMessage = signal<string | null>(null);

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
    const user = this.authStore.currentUser();
    if (user) {
      this.financeStore.connectTaxesStream(user.uid);
    }
  }

  setFilter(filter: 'Todos' | 'Pendente' | 'Pago'): void {
    this.statusFilter.set(filter);
  }

  openNewTaxModal(): void {
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

  async onDeleteTax(tax: AnnualTax): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !tax.id) return;

    const confirm = window.confirm(`Deseja realmente excluir "${tax.titulo}"?`);
    if (!confirm) return;

    try {
      await this.taxService.deleteTax(user.uid, tax.id);
      this.notificationService.success(`Tributo "${tax.titulo}" excluído.`);
    } catch (err: any) {
      this.notificationService.error('Erro ao excluir tributo: ' + err.message);
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
