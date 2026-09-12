import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { InstallmentService } from '../../core/services/installment.service';
import { AuthStore } from '../../core/state/auth.store';
import { NotificationService } from '../../core/services/notification.service';
import { InstallmentGroup, InstallmentParcel } from '../../core/models/finance.model';
import { formatBRL } from '../../core/utils/formatters';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-installments',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './installments.component.html',
  styleUrls: ['./installments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallmentsComponent implements OnInit {
  private installmentService = inject(InstallmentService);
  private authStore = inject(AuthStore);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly installmentGroups = signal<InstallmentGroup[]>([]);
  readonly isLoading = signal<boolean>(true);

  // Modal de Quitação Antecipada
  readonly isAdvanceModalOpen = signal<boolean>(false);
  readonly selectedGroupForAdvance = signal<InstallmentGroup | null>(null);
  readonly selectedParcelasToPay = signal<string[]>([]); // IDs das parcelas
  readonly isSavingBatch = signal<boolean>(false);

  // Modal de Cancelamento/Exclusão
  readonly isCancelModalOpen = signal<boolean>(false);
  readonly groupToCancel = signal<InstallmentGroup | null>(null);

  // Top Summary Cards
  readonly totalDebtRemaining = computed(() => {
    return this.installmentGroups().reduce((acc, g) => acc + g.saldo_restante, 0);
  });

  readonly totalAlreadyPaid = computed(() => {
    return this.installmentGroups().reduce((acc, g) => acc + g.total_pago, 0);
  });

  readonly activePurchasesCount = computed(() => {
    return this.installmentGroups().filter((g) => g.saldo_restante > 0).length;
  });

  readonly totalAdvanceSelectedAmount = computed(() => {
    const group = this.selectedGroupForAdvance();
    if (!group) return 0;
    const selectedIds = this.selectedParcelasToPay();
    return group.parcelas
      .filter((p) => selectedIds.includes(p.id))
      .reduce((acc, p) => acc + p.valor, 0);
  });

  ngOnInit(): void {
    this.loadInstallments();
  }

  loadInstallments(): void {
    const user = this.authStore.currentUser();
    if (!user) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.installmentService
      .getInstallmentsOverview(user.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.installmentGroups.set(groups);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.notificationService.error('Erro ao carregar parcelamentos: ' + err.message);
          this.isLoading.set(false);
        },
      });
  }

  // Quitação Antecipada
  openAdvanceModal(group: InstallmentGroup): void {
    this.selectedGroupForAdvance.set(group);
    // Pré-selecionar a próxima parcela pendente por default
    const nextPending = group.parcelas.find((p) => !p.status_pagamento);
    this.selectedParcelasToPay.set(nextPending ? [nextPending.id] : []);
    this.isAdvanceModalOpen.set(true);
  }

  toggleParcelaSelection(parcelaId: string): void {
    const current = this.selectedParcelasToPay();
    if (current.includes(parcelaId)) {
      this.selectedParcelasToPay.set(current.filter((id) => id !== parcelaId));
    } else {
      this.selectedParcelasToPay.set([...current, parcelaId]);
    }
  }

  async confirmAdvancePayment(): Promise<void> {
    const user = this.authStore.currentUser();
    const group = this.selectedGroupForAdvance();
    const selectedIds = this.selectedParcelasToPay();

    if (!user || !group || selectedIds.length === 0) return;

    this.isSavingBatch.set(true);

    try {
      const parcelasToUpdate = group.parcelas
        .filter((p) => selectedIds.includes(p.id))
        .map((p) => ({ mesAno: p.mesAno, expenseId: p.id }));

      await this.installmentService.payAdvanceInstallments(user.uid, parcelasToUpdate);

      this.notificationService.success(
        `Quitação de ${selectedIds.length} parcela(s) de "${group.descricao}" realizada com sucesso!`
      );
      this.isAdvanceModalOpen.set(false);
      this.loadInstallments();
    } catch (err: any) {
      this.notificationService.error('Erro ao quitar parcelas: ' + err.message);
    } finally {
      this.isSavingBatch.set(false);
    }
  }

  // Cancelamento de Parcelamento Futuro
  openCancelModal(group: InstallmentGroup): void {
    this.groupToCancel.set(group);
    this.isCancelModalOpen.set(true);
  }

  async confirmCancelGroup(): Promise<void> {
    const user = this.authStore.currentUser();
    const group = this.groupToCancel();
    if (!user || !group) return;

    try {
      // Excluir apenas as parcelas ainda pendentes
      const pendingParcelas = group.parcelas
        .filter((p) => !p.status_pagamento)
        .map((p) => ({ mesAno: p.mesAno, expenseId: p.id }));

      await this.installmentService.deleteInstallmentsBatch(user.uid, pendingParcelas);

      this.notificationService.success(
        `Parcelamento de "${group.descricao}" cancelado e parcelas futuras removidas.`
      );
      this.isCancelModalOpen.set(false);
      this.loadInstallments();
    } catch (err: any) {
      this.notificationService.error('Erro ao cancelar parcelamento: ' + err.message);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  onNewInstallment(): void {
    this.router.navigate(['/dashboard'], { queryParams: { action: 'new-installment' } });
  }

  formatCurrency(val: number): string {
    return formatBRL(val);
  }
}
