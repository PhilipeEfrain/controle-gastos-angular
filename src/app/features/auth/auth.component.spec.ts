import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthComponent } from './auth.component';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/state/auth.store';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let mockAuthService: any;
  let mockAuthStore: any;
  let router: Router;

  beforeEach(async () => {
    mockAuthService = {
      loginWithGoogle: vi.fn(),
      loginWithEmail: vi.fn(),
      registerWithEmail: vi.fn(),
      sendPasswordReset: vi.fn()
    };

    mockAuthStore = {
      setUser: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(async () => true);
    fixture.detectChanges();
  });

  it('deve instanciar o componente com aba inicial de login', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('login');
  });

  it('Cenário BDD: deve alternar entre abas de Login e Cadastro', () => {
    component.setTab('register');
    expect(component.activeTab()).toBe('register');

    component.setTab('forgot');
    expect(component.activeTab()).toBe('forgot');
  });

  it('Cenário BDD: deve autenticar com Google e redirecionar para o dashboard', async () => {
    const mockUser = { uid: 'u1', email: 'test@gmail.com', displayName: 'Google User', photoURL: null };
    mockAuthService.loginWithGoogle.mockResolvedValue(mockUser);

    await component.handleGoogleLogin();

    expect(mockAuthService.loginWithGoogle).toHaveBeenCalled();
    expect(mockAuthStore.setUser).toHaveBeenCalledWith(mockUser);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('Cenário BDD: deve exibir mensagem de erro amigável ao falhar autenticação', async () => {
    mockAuthService.loginWithEmail.mockRejectedValue({ code: 'auth/invalid-credential' });

    component.loginForm.setValue({ email: 'err@exemplo.com', password: 'password123' });
    await component.handleEmailLogin();

    expect(component.errorMessage()).toContain('E-mail ou senha incorretos');
  });

  it('Cenário BDD: deve exibir mensagem de bloqueio temporário em caso de excesso de tentativas (auth/too-many-requests)', async () => {
    mockAuthService.loginWithEmail.mockRejectedValue({ code: 'auth/too-many-requests' });

    component.loginForm.setValue({ email: 'err@exemplo.com', password: 'password123' });
    await component.handleEmailLogin();

    expect(component.errorMessage()).toContain('Acesso temporariamente bloqueado por excesso de tentativas');
  });

  it('Cenário BDD: deve enviar link de recuperação de senha com sucesso', async () => {
    mockAuthService.sendPasswordReset.mockResolvedValue(undefined);

    component.forgotForm.setValue({ email: 'reset@exemplo.com' });
    await component.handleForgotPassword();

    expect(mockAuthService.sendPasswordReset).toHaveBeenCalledWith('reset@exemplo.com');
    expect(component.successMessage()).toContain('Instruções de redefinição de senha enviadas');
  });

  it('Cenário BDD 3: deve exibir menção legal com links de Termos e Privacidade na aba de registro', () => {
    component.setTab('register');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const legalNotice = compiled.querySelector('.auth-legal-notice');
    expect(legalNotice).toBeTruthy();
    expect(legalNotice?.textContent).toContain('Ao criar sua conta, você concorda com nossos');
    expect(legalNotice?.textContent).toContain('Termos de Uso');
    expect(legalNotice?.textContent).toContain('Política de Privacidade');

    const links = Array.from(legalNotice?.querySelectorAll('a') || []).map(a => a.getAttribute('routerLink') || a.getAttribute('href'));
    expect(links).toContain('/termos');
    expect(links).toContain('/privacidade');
  });
});
