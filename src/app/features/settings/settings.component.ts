import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, AppTheme } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AsaasService } from '../../core/services/asaas.service';
import { AdminService } from '../../core/services/admin.service';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { SubscriptionModalComponent } from '../../shared/components/subscription-modal/subscription-modal.component';
import {
  formatBRL,
  maskCardNumber,
  maskCardExpiry,
  maskCardCvv,
  maskCardHolderName
} from '../../core/utils/formatters';

export type SettingsTab = 'profile' | 'appearance' | 'security' | 'subscription';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppCardComponent,
    ConfirmationModalComponent,
    SubscriptionModalComponent
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  readonly asaasService = inject(AsaasService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Aba ativa
  readonly activeTab = signal<SettingsTab>('profile');

  // Estados de salvamento e modais
  readonly isSavingProfile = signal<boolean>(false);
  readonly isSendingPasswordReset = signal<boolean>(false);
  readonly isDeleteAccountModalOpen = signal<boolean>(false);
  readonly isDeletingAccount = signal<boolean>(false);

  // Estados de Gestão de Assinatura
  readonly isSubscriptionModalOpen = signal<boolean>(false);
  readonly isChangeCardModalOpen = signal<boolean>(false);
  readonly isUpdatingCard = signal<boolean>(false);
  readonly isCancelSubscriptionModalOpen = signal<boolean>(false);
  readonly isCancelingSubscription = signal<boolean>(false);

  // Formulário de Troca de Cartão
  readonly cardNumber = signal<string>('');
  readonly cardHolderName = signal<string>('');
  readonly cardExpiry = signal<string>('');
  readonly cardCvv = signal<string>('');


  // Formulário de Perfil
  profileForm!: FormGroup;

  // Iniciais do usuário para avatar fallback
  readonly userInitials = computed(() => {
    const user = this.authStore.currentUser();
    const name = user?.displayName || user?.email || 'U';
    return name.slice(0, 2).toUpperCase();
  });

  // Validador customizado para URLs seguras HTTPS (CWE-79 / XSS)
  private static httpsUrlValidator(control: { value: string | null | undefined }): { [key: string]: any } | null {
    const value = control.value;
    if (!value || value.trim() === '') {
      return null;
    }
    const trimmed = value.trim();
    const httpsPattern = /^https:\/\/[a-zA-Z0-9\-\._~:\/\?#\[\]@!$&'\(\)\*\+,;=%]+$/i;
    if (!httpsPattern.test(trimmed)) {
      return { invalidHttpsUrl: true };
    }
    return null;
  }

  ngOnInit(): void {
    const user = this.authStore.currentUser();
    this.profileForm = this.fb.group({
      displayName: [user?.displayName || '', [Validators.required, Validators.minLength(2)]],
      photoURL: [user?.photoURL || '', [SettingsComponent.httpsUrlValidator]]
    });
  }

  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  async onSaveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) return;

    this.isSavingProfile.set(true);
    const { displayName, photoURL } = this.profileForm.value;

    try {
      const updated = await this.authService.updateProfileData(user.uid, {
        displayName,
        photoURL: photoURL || null
      });

      this.authStore.updateCurrentUser({
        displayName: updated.displayName,
        photoURL: updated.photoURL
      });

      this.notificationService.success('Perfil atualizado com sucesso!');
    } catch (err: any) {
      this.notificationService.error('Erro ao atualizar perfil: ' + (err.message || 'Tente novamente.'));
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  onThemeSelect(theme: AppTheme): void {
    this.themeService.setTheme(theme);
    const user = this.authStore.currentUser();
    if (user) {
      this.authService.updateProfileData(user.uid, {
        preferences: { theme, currency: 'BRL' }
      }).catch(err => console.warn('Erro ao sincronizar preferência de tema no Firestore:', err));
    }
    const themeLabels: Record<AppTheme, string> = {
      'dark': 'Escuro Quinzena',
      'dark-blue': 'Escuro Azul (Original)',
      'light': 'Modo Claro'
    };
    this.notificationService.info(`Tema alterado para ${themeLabels[theme]}.`);
  }

  async onSendPasswordReset(): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user || !user.email) return;

    this.isSendingPasswordReset.set(true);
    try {
      await this.authService.sendPasswordReset(user.email);
      this.notificationService.success(`E-mail de redefinição de senha enviado para ${user.email}.`);
    } catch (err: any) {
      this.notificationService.error('Erro ao enviar e-mail de redefinição: ' + (err.message || 'Tente novamente.'));
    } finally {
      this.isSendingPasswordReset.set(false);
    }
  }

  async onLogout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigate(['/auth']);
  }

  openDeleteAccountModal(): void {
    this.isDeleteAccountModalOpen.set(true);
  }

  closeDeleteAccountModal(): void {
    if (!this.isDeletingAccount()) {
      this.isDeleteAccountModalOpen.set(false);
    }
  }

  async onConfirmDeleteAccount(): Promise<void> {
    const user = this.authStore.currentUser();
    if (!user) return;

    this.isDeletingAccount.set(true);
    try {
      await this.authStore.deleteAccount();
      this.notificationService.info('Sua conta e todos os dados foram excluídos definitivamente.');
      this.isDeleteAccountModalOpen.set(false);
      this.router.navigate(['/auth']);
    } catch (err: any) {
      this.notificationService.error('Erro ao excluir conta: ' + (err.message || 'Tente novamente.'));
    } finally {
      this.isDeletingAccount.set(false);
    }
  }

  // --- MÉTODOS DE GESTÃO DE ASSINATURA ---

  readonly isCardFormValid = computed(() => {
    const rawNumber = this.cardNumber().replace(/\D/g, '');
    const hasValidNumber = rawNumber.length >= 13 && rawNumber.length <= 19;
    const hasValidName = this.cardHolderName().trim().length >= 3;
    const hasValidExpiry = /^(0[1-9]|1[0-2])\/\d{2}$/.test(this.cardExpiry());
    const hasValidCvv = this.cardCvv().length >= 3 && this.cardCvv().length <= 4;
    return hasValidNumber && hasValidName && hasValidExpiry && hasValidCvv;
  });

  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = maskCardNumber(input.value);
    input.value = formatted;
    this.cardNumber.set(formatted);
  }

  onCardHolderNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = maskCardHolderName(input.value);
    input.value = formatted;
    this.cardHolderName.set(formatted);
  }

  onCardExpiryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = maskCardExpiry(input.value);
    input.value = formatted;
    this.cardExpiry.set(formatted);
  }

  onCardCvvInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = maskCardCvv(input.value);
    input.value = formatted;
    this.cardCvv.set(formatted);
  }

  openUpgradeModal(): void {
    this.isSubscriptionModalOpen.set(true);
  }

  closeUpgradeModal(): void {
    this.isSubscriptionModalOpen.set(false);
  }

  openChangeCardModal(): void {
    this.cardNumber.set('');
    this.cardHolderName.set('');
    this.cardExpiry.set('');
    this.cardCvv.set('');
    this.isChangeCardModalOpen.set(true);
  }

  closeChangeCardModal(): void {
    if (!this.isUpdatingCard()) {
      this.isChangeCardModalOpen.set(false);
    }
  }

  async onConfirmChangeCard(): Promise<void> {
    if (!this.isCardFormValid()) {
      this.notificationService.error('Preencha os dados do cartão corretamente.');
      return;
    }

    const user = this.authStore.currentUser();
    const subId = user?.asaasSubscriptionId;
    if (!subId) {
      this.notificationService.error('Identificador de assinatura não localizado.');
      return;
    }

    this.isUpdatingCard.set(true);
    try {
      const asaasConfig = await this.adminService.getAsaasConfig();
      const apiKey = asaasConfig?.apiKey || undefined;
      const environment = asaasConfig?.environment || 'sandbox';

      const expiryParts = this.cardExpiry().split('/');
      const expiryMonth = expiryParts[0].padStart(2, '0');
      const expiryYear = expiryParts[1].length === 2 ? '20' + expiryParts[1] : expiryParts[1];

      await this.asaasService.updateSubscriptionCreditCard(
        subId,
        {
          holderName: this.cardHolderName().trim(),
          number: this.cardNumber().replace(/\D/g, ''),
          expiryMonth,
          expiryYear,
          ccv: this.cardCvv().trim()
        },
        undefined,
        apiKey,
        environment
      );

      this.notificationService.success('Cartão de crédito atualizado com sucesso no gateway Asaas!');
      this.isChangeCardModalOpen.set(false);
    } catch (err: any) {
      this.notificationService.error('Erro ao atualizar cartão: ' + (err.message || 'Tente novamente.'));
    } finally {
      this.isUpdatingCard.set(false);
    }
  }

  openCancelSubscriptionModal(): void {
    this.isCancelSubscriptionModalOpen.set(true);
  }

  closeCancelSubscriptionModal(): void {
    if (!this.isCancelingSubscription()) {
      this.isCancelSubscriptionModalOpen.set(false);
    }
  }

  async onConfirmCancelSubscription(): Promise<void> {
    this.isCancelingSubscription.set(true);
    try {
      const user = this.authStore.currentUser();
      if (user?.asaasSubscriptionId) {
        const asaasConfig = await this.adminService.getAsaasConfig();
        const apiKey = asaasConfig?.apiKey || undefined;
        const environment = asaasConfig?.environment || 'sandbox';
        try {
          await this.asaasService.cancelSubscription(user.asaasSubscriptionId, apiKey, environment);
        } catch (gatewayErr) {
          console.warn('Aviso: Erro ao cancelar no gateway Asaas (prosseguindo com cancelamento local):', gatewayErr);
        }
      }

      await this.authStore.cancelSubscription();

      const expiresDate = this.authStore.planExpiresAtFormatted();
      const expirationMsg = expiresDate ? ` Seus benefícios continuam válidos até ${expiresDate}.` : '';
      this.notificationService.info(`Assinatura cancelada com sucesso.${expirationMsg} Seus dados foram preservados.`);
      this.isCancelSubscriptionModalOpen.set(false);
    } catch (err: any) {
      this.notificationService.error('Erro ao cancelar assinatura: ' + (err.message || 'Tente novamente.'));
    } finally {
      this.isCancelingSubscription.set(false);
    }
  }

  getPlanPriceFormatted(): string {
    return formatBRL(this.asaasService.getPlanPrice(this.authStore.currentPlan()));
  }
}

