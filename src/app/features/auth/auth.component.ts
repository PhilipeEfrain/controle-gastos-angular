import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/state/auth.store';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

export type AuthTab = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppCardComponent, BrandLogoComponent],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly activeTab = signal<AuthTab>('login');
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  // Formulários Reativos
  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  setTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(prev => !prev);
  }

  /**
   * Login com Google
   */
  async handleGoogleLogin(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const user = await this.authService.loginWithGoogle();
      this.authStore.setUser(user);
      this.redirectToDestination();
    } catch (err: any) {
      console.error('[AuthComponent] Erro no login Google:', err);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        this.errorMessage.set(this.getFriendlyErrorMessage(err?.code));
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Submissão do Login com Email/Senha
   */
  async handleEmailLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    try {
      const user = await this.authService.loginWithEmail(email, password);
      this.authStore.setUser(user);
      this.redirectToDestination();
    } catch (err: any) {
      console.error('[AuthComponent] Erro no login com email:', err);
      this.errorMessage.set(this.getFriendlyErrorMessage(err?.code));
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Submissão do Cadastro de novo usuário
   */
  async handleRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { name, email, password } = this.registerForm.value;

    try {
      const user = await this.authService.registerWithEmail(email, password, name);
      this.authStore.setUser(user);
      this.redirectToDestination();
    } catch (err: any) {
      console.error('[AuthComponent] Erro no cadastro:', err);
      this.errorMessage.set(this.getFriendlyErrorMessage(err?.code));
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Submissão de Recuperação de Senha
   */
  async handleForgotPassword(): Promise<void> {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { email } = this.forgotForm.value;

    try {
      await this.authService.sendPasswordReset(email);
      this.successMessage.set('Instruções de redefinição de senha enviadas para o seu e-mail!');
      this.forgotForm.reset();
    } catch (err: any) {
      console.error('[AuthComponent] Erro na recuperação de senha:', err);
      this.errorMessage.set(this.getFriendlyErrorMessage(err?.code));
    } finally {
      this.isLoading.set(false);
    }
  }

  private redirectToDestination(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private getFriendlyErrorMessage(code?: string): string {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos. Verifique suas credenciais.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está em uso por outra conta.';
      case 'auth/invalid-email':
        return 'Formato de e-mail inválido.';
      case 'auth/weak-password':
        return 'A senha deve conter no mínimo 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Acesso temporariamente bloqueado por excesso de tentativas. Aguarde alguns minutos ou redefina sua senha.';
      case 'auth/network-request-failed':
        return 'Falha de conexão com o servidor. Verifique sua internet.';
      default:
        return 'Ocorreu um erro ao processar sua autenticação. Tente novamente.';
    }
  }
}
