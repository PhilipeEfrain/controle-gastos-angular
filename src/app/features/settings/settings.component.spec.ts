import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserProfile } from '../../core/models/user.model';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  const mockUser: UserProfile = {
    uid: 'usr-999',
    email: 'dev@financas.com',
    displayName: 'Carlos Silva',
    photoURL: 'https://exemplo.com/avatar.jpg',
    preferences: { theme: 'dark', currency: 'BRL' }
  };

  let mockAuthStore: any;
  let mockAuthService: any;
  let mockThemeService: any;
  let mockNotificationService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      userDisplayName: signal<string>('Carlos Silva'),
      updateCurrentUser: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthService = {
      updateProfileData: vi.fn().mockResolvedValue({
        uid: 'usr-999',
        displayName: 'Carlos Eduardo',
        photoURL: 'https://exemplo.com/avatar2.jpg',
        preferences: { theme: 'dark', currency: 'BRL' }
      }),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined)
    };

    mockThemeService = {
      currentTheme: signal<'dark' | 'light'>('dark'),
      isDark: signal<boolean>(true),
      setTheme: vi.fn(),
      toggleTheme: vi.fn()
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser instanciado com sucesso', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('profile');
  });

  it('deve alternar abas de navegação', () => {
    component.setTab('appearance');
    expect(component.activeTab()).toBe('appearance');

    component.setTab('security');
    expect(component.activeTab()).toBe('security');
  });

  describe('Cenário BDD: Atualização de nome e dados do perfil', () => {
    it('deve atualizar o nome e sincronizar no Firestore e AuthStore', async () => {
      component.profileForm.patchValue({
        displayName: 'Carlos Eduardo',
        photoURL: 'https://exemplo.com/avatar2.jpg'
      });

      await component.onSaveProfile();

      expect(mockAuthService.updateProfileData).toHaveBeenCalledWith('usr-999', {
        displayName: 'Carlos Eduardo',
        photoURL: 'https://exemplo.com/avatar2.jpg'
      });
      expect(mockAuthStore.updateCurrentUser).toHaveBeenCalledWith({
        displayName: 'Carlos Eduardo',
        photoURL: 'https://exemplo.com/avatar2.jpg'
      });
      expect(mockNotificationService.success).toHaveBeenCalledWith('Perfil atualizado com sucesso!');
    });

    it('não deve salvar se o formulário for inválido', async () => {
      component.profileForm.patchValue({ displayName: '' });
      await component.onSaveProfile();

      expect(mockAuthService.updateProfileData).not.toHaveBeenCalled();
    });

    it('deve invalidar o campo photoURL se a URL não iniciar com https:// (CWE-79 / XSS)', async () => {
      component.profileForm.patchValue({
        displayName: 'Carlos Eduardo',
        photoURL: 'javascript:alert(1)'
      });

      expect(component.profileForm.valid).toBe(false);
      expect(component.profileForm.get('photoURL')?.hasError('invalidHttpsUrl')).toBe(true);

      component.profileForm.patchValue({ photoURL: 'http://inseguro.com/foto.jpg' });
      expect(component.profileForm.valid).toBe(false);
      expect(component.profileForm.get('photoURL')?.hasError('invalidHttpsUrl')).toBe(true);

      component.profileForm.patchValue({ photoURL: 'https://seguro.com/foto.jpg' });
      expect(component.profileForm.valid).toBe(true);

      component.profileForm.patchValue({ photoURL: '' });
      expect(component.profileForm.valid).toBe(true);
    });
  });

  describe('Cenário BDD: Alternância de tema Dark/Light/Dark-Blue', () => {
    it('deve selecionar tema claro e sincronizar no ThemeService e Firestore', () => {
      component.onThemeSelect('light');

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('light');
      expect(mockAuthService.updateProfileData).toHaveBeenCalledWith('usr-999', {
        preferences: { theme: 'light', currency: 'BRL' }
      });
      expect(mockNotificationService.info).toHaveBeenCalledWith('Tema alterado para Modo Claro.');
    });

    it('deve selecionar tema Escuro Azul e sincronizar no ThemeService e Firestore', () => {
      component.onThemeSelect('dark-blue');

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark-blue');
      expect(mockAuthService.updateProfileData).toHaveBeenCalledWith('usr-999', {
        preferences: { theme: 'dark-blue', currency: 'BRL' }
      });
      expect(mockNotificationService.info).toHaveBeenCalledWith('Tema alterado para Escuro Azul (Original).');
    });
  });

  describe('Cenário BDD: Segurança e Redefinição de Senha', () => {
    it('deve enviar e-mail de redefinição de senha', async () => {
      await component.onSendPasswordReset();

      expect(mockAuthService.sendPasswordReset).toHaveBeenCalledWith('dev@financas.com');
      expect(mockNotificationService.success).toHaveBeenCalledWith(
        'E-mail de redefinição de senha enviado para dev@financas.com.'
      );
    });

    it('deve realizar logout e navegar para /auth', async () => {
      await component.onLogout();

      expect(mockAuthStore.logout).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth']);
    });
  });
});
