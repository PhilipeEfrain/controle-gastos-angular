import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, AppTheme } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

export type SettingsTab = 'profile' | 'appearance' | 'security';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppCardComponent, ConfirmationModalComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Aba ativa
  readonly activeTab = signal<SettingsTab>('profile');

  // Estados de salvamento e modais
  readonly isSavingProfile = signal<boolean>(false);
  readonly isSendingPasswordReset = signal<boolean>(false);
  readonly isDeleteAccountModalOpen = signal<boolean>(false);
  readonly isDeletingAccount = signal<boolean>(false);

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
}
