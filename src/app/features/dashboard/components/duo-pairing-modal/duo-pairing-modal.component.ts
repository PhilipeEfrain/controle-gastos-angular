import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  effect,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DuoService } from '../../../../core/services/duo.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { DuoGroup } from '../../../../core/models/duo.model';

@Component({
  selector: 'app-duo-pairing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './duo-pairing-modal.component.html',
  styleUrls: ['./duo-pairing-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DuoPairingModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly initialInviteCode = input<string>('');
  readonly close = output<void>();

  private readonly duoService = inject(DuoService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationService = inject(NotificationService);

  readonly currentGroup = signal<DuoGroup | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly inviteCodeInput = signal<string>('');
  readonly isCopied = signal<boolean>(false);
  readonly partnerEmailInput = signal<string>('');
  readonly isSavingEmail = signal<boolean>(false);

  readonly isOwner = computed(() => {
    const group = this.currentGroup();
    const uid = this.authStore.currentUser()?.uid;
    return group?.ownerId === uid;
  });

  readonly isConnected = computed(() => {
    return this.currentGroup()?.status === 'active' && !!this.currentGroup()?.partnerId;
  });

  constructor() {
    effect(async () => {
      if (this.isOpen()) {
        if (this.initialInviteCode()) {
          this.inviteCodeInput.set(this.initialInviteCode());
        }
        await this.loadGroupData();
      }
    });
  }

  async loadGroupData(): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user?.uid) return;

    this.isLoading.set(true);
    try {
      let group = await this.duoService.getDuoGroupForUser(user.uid);
      if (!group && this.authStore.isDuo()) {
        group = await this.duoService.createOrGetDuoGroup(
          user.uid,
          user.email || '',
          user.displayName || 'Titular'
        );
      }
      this.currentGroup.set(group);
      if (group?.partnerEmail) {
        this.partnerEmailInput.set(group.partnerEmail);
      }
    } catch (err) {
      console.error('Erro ao carregar grupo Duo:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onCopyInviteCode(): Promise<void> {
    const code = this.currentGroup()?.inviteCode;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      this.isCopied.set(true);
      this.notificationService.success(`Código de convite ${code} copiado!`);
      setTimeout(() => this.isCopied.set(false), 3000);
    } catch {
      this.notificationService.info(`Código: ${code}`);
    }
  }

  onShareWhatsApp(): void {
    const code = this.currentGroup()?.inviteCode;
    if (!code) return;

    const directLink = `https://app.quinzena.com.br/dashboard?duoCode=${code}`;
    const message = `Oi! Assinei o Quinzena Duo para organizarmos nossas contas juntos. Acesse o link direto para conectar nossas contas: ${directLink} (ou use o código ${code} no seu app)`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    this.notificationService.info('Abrindo WhatsApp para enviar o convite...');
  }

  async onSavePartnerEmail(): Promise<void> {
    const group = this.currentGroup();
    const email = this.partnerEmailInput().trim().toLowerCase();
    if (!group?.id) return;

    if (!email || !email.includes('@') || !email.includes('.')) {
      this.notificationService.error('Por favor, informe um e-mail válido para o(a) parceiro(a).');
      return;
    }

    this.isSavingEmail.set(true);
    try {
      await this.duoService.updatePartnerEmail(group.id, email);
      this.currentGroup.set({ ...group, partnerEmail: email });
      this.notificationService.success('E-mail do parceiro salvo com sucesso! 💕');
    } catch (err) {
      this.notificationService.error('Erro ao salvar e-mail do parceiro.');
    } finally {
      this.isSavingEmail.set(false);
    }
  }

  async onAcceptInvite(): Promise<void> {
    const code = this.inviteCodeInput().trim();
    if (!code) {
      this.notificationService.error('Digite o código de convite recebido.');
      return;
    }

    const user = this.authStore.currentUser();
    if (!user?.uid) return;

    this.isLoading.set(true);
    try {
      const group = await this.duoService.acceptInvite(
        code,
        user.uid,
        user.email || '',
        user.displayName || 'Parceiro(a)'
      );
      this.currentGroup.set(group);
      this.inviteCodeInput.set('');
      this.authStore.updateCurrentUser({ plan: 'duo', planStatus: 'active' });
      this.notificationService.success('Contas conectadas com sucesso no Modo Casal! 💕');
    } catch (err: any) {
      this.notificationService.error(err.message || 'Não foi possível conectar ao convite.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onDisconnect(): Promise<void> {
    const group = this.currentGroup();
    if (!group?.id) return;

    const confirm = window.confirm('Deseja realmente desvincular o parceiro do Modo Casal?');
    if (!confirm) return;

    this.isLoading.set(true);
    try {
      await this.duoService.disconnectPartner(group.id);
      await this.loadGroupData();
      this.notificationService.info('Parceiro desvinculado com sucesso.');
    } catch (err) {
      this.notificationService.error('Erro ao desvincular parceiro.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
