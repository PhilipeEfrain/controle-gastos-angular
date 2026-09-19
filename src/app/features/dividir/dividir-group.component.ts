import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SplitService } from '../../core/services/split.service';
import { DividirPdfService } from '../../core/services/dividir-pdf.service';
import { AuthStore } from '../../core/state/auth.store';
import { ExpenseService } from '../../core/services/expense.service';
import { NotificationService } from '../../core/services/notification.service';
import { getCurrentYearMonth } from '../../core/utils/date';
import {
  SplitGroup,
  SplitExpense,
  SplitParticipant,
  DebtSettlement,
  PixKeyType
} from '../../core/models/split-group.model';
import { calculateEqualShares, calculateGroupSummary } from '../../core/utils/debt-simplifier';
import { formatBRL } from '../../core/utils/formatters';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-dividir-group',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AppCardComponent,
    BrandLogoComponent,
    ConfirmationModalComponent
  ],
  templateUrl: './dividir-group.component.html',
  styleUrls: ['./dividir-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DividirGroupComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private splitService = inject(SplitService);
  private pdfService = inject(DividirPdfService);
  private authStore = inject(AuthStore);
  private expenseService = inject(ExpenseService);
  private notificationService = inject(NotificationService);

  readonly currentUser = this.authStore.currentUser;
  readonly isAuthenticated = this.authStore.isAuthenticated;

  readonly groupId = signal<string>('');
  readonly group = signal<SplitGroup | null>(null);
  readonly expenses = signal<SplitExpense[]>([]);
  readonly isLoading = signal<boolean>(true);

  // Participante selecionado (para convidados ou auto-detect)
  readonly selectedParticipantId = signal<string>('');
  readonly copiedPixKey = signal<string | null>(null);

  // Modais
  readonly isAddExpenseModalOpen = signal<boolean>(false);
  readonly isAddParticipantModalOpen = signal<boolean>(false);
  readonly isSyncQuinzenaModalOpen = signal<boolean>(false);
  readonly isConfirmModalOpen = signal<boolean>(false);
  readonly confirmModalTitle = signal<string>('Confirmar exclusão');
  readonly confirmModalMessage = signal<string>('');
  private pendingDeleteAction: (() => Promise<void>) | null = null;

  // Form: Nova Despesa
  expenseDesc = '';
  expenseAmount: number | null = null;
  expensePayerId = '';
  expenseDate = new Date().toISOString().substring(0, 10);

  // Form: Novo Participante
  newPartName = '';
  newPartPix = '';
  newPartPixType: PixKeyType = 'aleatoria';

  // Form: Sincronizar Quinzena
  syncFortnight: 1 | 2 = 1;

  private subs = new Subscription();

  // Sumário calculado reativamente com o algoritmo guloso
  readonly summary = computed(() => {
    const grp = this.group();
    if (!grp) return null;
    return calculateGroupSummary(grp.participants, this.expenses());
  });

  // Identificação de papel
  readonly isOwner = computed(() => {
    const grp = this.group();
    const user = this.currentUser();
    return grp && user && grp.ownerId === user.uid;
  });

  readonly mySettlementsToPay = computed(() => {
    const sum = this.summary();
    const pid = this.selectedParticipantId();
    if (!sum || !pid) return [];
    return sum.settlements.filter((s) => s.fromParticipantId === pid);
  });

  readonly mySettlementsToReceive = computed(() => {
    const sum = this.summary();
    const pid = this.selectedParticipantId();
    if (!sum || !pid) return [];
    return sum.settlements.filter((s) => s.toParticipantId === pid);
  });

  readonly myBalance = computed(() => {
    const sum = this.summary();
    const pid = this.selectedParticipantId();
    if (!sum || !pid) return null;
    return sum.balances.find((b) => b.participantId === pid) || null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/dividir']);
      return;
    }
    this.groupId.set(id);

    this.subs.add(
      this.splitService.listenToGroup(id).subscribe({
        next: (grp) => {
          this.group.set(grp);
          this.isLoading.set(false);
          this.autoSelectParticipant(grp);
        },
        error: (err) => {
          console.error(err);
          this.isLoading.set(false);
        }
      })
    );

    this.subs.add(
      this.splitService.listenToExpenses(id).subscribe({
        next: (exps) => {
          this.expenses.set(exps);
        },
        error: (err) => console.error(err)
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private autoSelectParticipant(grp: SplitGroup | null): void {
    if (!grp) return;

    const user = this.currentUser();
    if (user && grp.ownerId === user.uid) {
      this.selectedParticipantId.set(user.uid);
      return;
    }

    const savedId = localStorage.getItem(`dividir_active_part_${grp.id}`);
    if (savedId && grp.participants.some((p) => p.id === savedId)) {
      this.selectedParticipantId.set(savedId);
      return;
    }

    // Default para o primeiro da lista se não houver seleção
    if (grp.participants.length > 0 && !this.selectedParticipantId()) {
      this.selectedParticipantId.set(grp.participants[0].id);
    }
  }

  onSelectParticipant(id: string): void {
    this.selectedParticipantId.set(id);
    const grp = this.group();
    if (grp?.id) {
      localStorage.setItem(`dividir_active_part_${grp.id}`, id);
    }
  }

  copyPixKey(key: string | undefined): void {
    if (!key) {
      this.notificationService.show('Chave PIX não cadastrada para este participante.', 'warning');
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key).then(() => {
        this.copiedPixKey.set(key);
        this.notificationService.success('Chave PIX copiada para a área de transferência!');
        setTimeout(() => {
          if (this.copiedPixKey() === key) {
            this.copiedPixKey.set(null);
          }
        }, 2500);
      });
    } else {
      this.notificationService.show(`Chave PIX: ${key}`, 'info');
    }
  }

  shareOnWhatsApp(): void {
    const grp = this.group();
    if (!grp) return;

    const currentUrl = window.location.href;
    const text = encodeURIComponent(
      `🤝 *${grp.title}* — Divisão de despesas no Quinzena Dividir:\n\nAcesse o link para ver o saldo e os acertos via PIX:\n${currentUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  openAddExpenseModal(): void {
    if (!this.isAuthenticated()) {
      this.notificationService.show('Para lançar novas despesas, crie ou acesse sua conta no Quinzena.', 'warning');
      this.router.navigate(['/auth'], { queryParams: { redirect: this.router.url } });
      return;
    }

    const grp = this.group();
    this.expenseDesc = '';
    this.expenseAmount = null;
    this.expensePayerId = this.selectedParticipantId() || grp?.participants[0]?.id || '';
    this.expenseDate = new Date().toISOString().substring(0, 10);
    this.isAddExpenseModalOpen.set(true);
  }

  closeAddExpenseModal(): void {
    this.isAddExpenseModalOpen.set(false);
  }

  async submitAddExpense(): Promise<void> {
    const desc = this.expenseDesc.trim();
    const amount = Number(this.expenseAmount);
    const grp = this.group();

    if (!desc || !amount || amount <= 0 || !grp) {
      this.notificationService.show('Preencha a descrição e um valor válido.', 'warning');
      return;
    }

    // Calcula divisão igualitária entre todos os participantes
    const participantIds = grp.participants.map((p) => p.id);
    const shares = calculateEqualShares(amount, participantIds);

    try {
      await this.splitService.addExpense(grp.id!, {
        description: desc,
        amount,
        paidByParticipantId: this.expensePayerId,
        splitType: 'equal',
        shares,
        date: this.expenseDate,
        createdBy: this.currentUser()?.uid
      });

      this.notificationService.success('Despesa adicionada com sucesso!');
      this.closeAddExpenseModal();
    } catch (err) {
      console.error(err);
      this.notificationService.show('Erro ao adicionar despesa.', 'error');
    }
  }

  deleteExpense(expenseId: string): void {
    const grp = this.group();
    if (!grp?.id) return;

    this.confirmModalTitle.set('Excluir despesa');
    this.confirmModalMessage.set('Tem certeza de que deseja remover esta despesa do grupo? O acerto de contas será recalculado.');
    this.pendingDeleteAction = async () => {
      await this.splitService.deleteExpense(grp.id!, expenseId);
      this.notificationService.success('Despesa excluída com sucesso.');
    };
    this.isConfirmModalOpen.set(true);
  }

  deleteEntireGroup(): void {
    const grp = this.group();
    if (!grp?.id) return;

    this.confirmModalTitle.set('Excluir grupo definitivamente');
    this.confirmModalMessage.set('Esta ação apagará permanentemente o grupo e todo o histórico de despesas. Não é possível desfazer.');
    this.pendingDeleteAction = async () => {
      await this.splitService.deleteGroup(grp.id!);
      this.notificationService.success('Grupo e histórico excluídos com sucesso.');
      this.router.navigate(['/dividir']);
    };
    this.isConfirmModalOpen.set(true);
  }

  async onConfirmDelete(): Promise<void> {
    if (this.pendingDeleteAction) {
      try {
        await this.pendingDeleteAction();
      } catch (err) {
        console.error(err);
        this.notificationService.show('Não foi possível concluir a exclusão.', 'error');
      }
      this.pendingDeleteAction = null;
    }
    this.isConfirmModalOpen.set(false);
  }

  onCancelDelete(): void {
    this.pendingDeleteAction = null;
    this.isConfirmModalOpen.set(false);
  }

  exportPdf(): void {
    const grp = this.group();
    const sum = this.summary();
    if (!grp || !sum) return;
    this.pdfService.exportGroupSummaryPdf(grp, this.expenses(), sum);
  }

  openSyncQuinzenaModal(): void {
    this.isSyncQuinzenaModalOpen.set(true);
  }

  closeSyncQuinzenaModal(): void {
    this.isSyncQuinzenaModalOpen.set(false);
  }

  async submitSyncToQuinzena(): Promise<void> {
    const grp = this.group();
    const bal = this.myBalance();
    if (!grp || !bal) return;

    const net = bal.netBalance;
    if (Math.abs(net) < 0.01) {
      this.notificationService.show('Seu saldo já está zerado!', 'info');
      this.closeSyncQuinzenaModal();
      return;
    }

    const user = this.currentUser();
    if (!user) return;
    const mesAno = getCurrentYearMonth();

    try {
      if (net < 0) {
        // Devedor: lança como despesa na quinzena
        await this.expenseService.addExpense(user.uid, mesAno, {
          descricao: `Divisão: ${grp.title}`,
          valor: Math.abs(net),
          quinzena: this.syncFortnight,
          status_pagamento: false,
          categoria: 'Outros',
          tipo: 'despesa'
        });
        this.notificationService.success(`Lançado como despesa na Q${this.syncFortnight} do seu Quinzena.`);
      } else {
        // Credor: lança como renda extra na quinzena
        await this.expenseService.addExpense(user.uid, mesAno, {
          descricao: `Reembolso: ${grp.title}`,
          valor: net,
          quinzena: this.syncFortnight,
          status_pagamento: false,
          categoria: 'Outros',
          tipo: 'renda_extra'
        });
        this.notificationService.success(`Lançado como renda extra na Q${this.syncFortnight} do seu Quinzena.`);
      }
      this.closeSyncQuinzenaModal();
    } catch (err) {
      console.error(err);
      this.notificationService.show('Não foi possível sincronizar com o Quinzena.', 'error');
    }
  }

  formatMoney(val: number | undefined): string {
    return formatBRL(val || 0);
  }

  getPayerName(id: string): string {
    return this.group()?.participants.find((p) => p.id === id)?.name || 'Desconhecido';
  }
}
