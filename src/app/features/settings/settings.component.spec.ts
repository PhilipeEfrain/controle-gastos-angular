import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { AsaasService } from '../../core/services/asaas.service';
import { AdminService } from '../../core/services/admin.service';
import { DuoService } from '../../core/services/duo.service';
import { UserProfile } from '../../core/models/user.model';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockDuoService: any;

  const mockUser: UserProfile = {
    uid: 'usr-999',
    email: 'dev@financas.com',
    displayName: 'Carlos Silva',
    photoURL: 'https://exemplo.com/avatar.jpg',
    plan: 'pro',
    planStatus: 'active',
    planExpiresAt: '2026-10-10T00:00:00.000Z',
    asaasSubscriptionId: 'sub_test_123',
    preferences: { theme: 'dark', currency: 'BRL' }
  };

  let mockAuthStore: any;
  let mockAuthService: any;
  let mockThemeService: any;
  let mockNotificationService: any;
  let mockAsaasService: any;
  let mockAdminService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      userDisplayName: signal<string>('Carlos Silva'),
      currentPlan: signal<'free' | 'pro' | 'duo'>('pro'),
      isDuo: signal<boolean>(false),
      planStatus: signal<string>('active'),
      isGracePeriodActive: signal<boolean>(false),
      isPlanSuspended: signal<boolean>(false),
      planExpiresAtFormatted: signal<string>('10/10/2026'),
      gracePeriodDeadlineFormatted: signal<string>(''),
      updateCurrentUser: vi.fn(),
      cancelSubscription: vi.fn().mockResolvedValue(undefined),
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

    mockAsaasService = {
      getPlanPrice: vi.fn().mockReturnValue(9.90),
      updateSubscriptionCreditCard: vi.fn().mockResolvedValue({ id: 'sub_test_123', status: 'ACTIVE' }),
      cancelSubscription: vi.fn().mockResolvedValue({ deleted: true, id: 'sub_test_123' })
    };

    mockAdminService = {
      getAsaasConfig: vi.fn().mockResolvedValue({ apiKey: 'fake_key', environment: 'sandbox' })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    mockDuoService = {
      getDuoGroupForUser: vi.fn().mockResolvedValue(null),
      createOrGetDuoGroup: vi.fn().mockResolvedValue(null)
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AsaasService, useValue: mockAsaasService },
        { provide: AdminService, useValue: mockAdminService },
        { provide: DuoService, useValue: mockDuoService },
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

    it('Cenário BDD: deve abrir modal de exclusão e excluir conta definitivamente com feedback', async () => {
      mockAuthStore.deleteAccount = vi.fn().mockResolvedValue(undefined);

      component.openDeleteAccountModal();
      expect(component.isDeleteAccountModalOpen()).toBe(true);

      await component.onConfirmDeleteAccount();

      expect(mockAuthStore.deleteAccount).toHaveBeenCalled();
      expect(mockNotificationService.info).toHaveBeenCalledWith(
        'Sua conta e todos os dados foram excluídos definitivamente.'
      );
      expect(component.isDeleteAccountModalOpen()).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth']);
    });
  });

  describe('Cenário BDD: Minha Assinatura, Vigência e Gestão de Pagamento', () => {
    it('deve alternar para a aba subscription e exibir preço formatado', () => {
      component.setTab('subscription');
      expect(component.activeTab()).toBe('subscription');
      expect(component.getPlanPriceFormatted()).toBe('R$\u00A09,90');
    });

    it('deve abrir e fechar modal de upgrade para planos pagos', () => {
      component.openUpgradeModal();
      expect(component.isSubscriptionModalOpen()).toBe(true);

      component.closeUpgradeModal();
      expect(component.isSubscriptionModalOpen()).toBe(false);
    });

    it('deve abrir modal de troca de cartão e validar preenchimento correto', () => {
      component.openChangeCardModal();
      expect(component.isChangeCardModalOpen()).toBe(true);
      expect(component.isCardFormValid()).toBe(false);

      // Simula preenchimento com máscaras
      component.onCardNumberInput({ target: { value: '4532 1111 2222 3333' } } as any);
      component.onCardHolderNameInput({ target: { value: 'CARLOS SILVA' } } as any);
      component.onCardExpiryInput({ target: { value: '12/28' } } as any);
      component.onCardCvvInput({ target: { value: '123' } } as any);

      expect(component.isCardFormValid()).toBe(true);
    });

    it('deve chamar updateSubscriptionCreditCard no AsaasService e exibir toast de sucesso', async () => {
      component.openChangeCardModal();
      component.onCardNumberInput({ target: { value: '4532 1111 2222 3333' } } as any);
      component.onCardHolderNameInput({ target: { value: 'CARLOS SILVA' } } as any);
      component.onCardExpiryInput({ target: { value: '12/28' } } as any);
      component.onCardCvvInput({ target: { value: '123' } } as any);

      await component.onConfirmChangeCard();

      expect(mockAsaasService.updateSubscriptionCreditCard).toHaveBeenCalledWith(
        'sub_test_123',
        expect.objectContaining({
          holderName: 'CARLOS SILVA',
          number: '4532111122223333',
          expiryMonth: '12',
          expiryYear: '2028',
          ccv: '123'
        }),
        undefined,
        'fake_key',
        'sandbox'
      );
      expect(mockNotificationService.success).toHaveBeenCalledWith(
        'Cartão de crédito atualizado com sucesso no gateway Asaas!'
      );
      expect(component.isChangeCardModalOpen()).toBe(false);
    });

    it('deve abrir modal de cancelamento e processar cancelamento assistido com preservação de dados', async () => {
      component.openCancelSubscriptionModal();
      expect(component.isCancelSubscriptionModalOpen()).toBe(true);

      await component.onConfirmCancelSubscription();

      expect(mockAsaasService.cancelSubscription).toHaveBeenCalledWith('sub_test_123', 'fake_key', 'sandbox');
      expect(mockAuthStore.cancelSubscription).toHaveBeenCalled();
      expect(mockNotificationService.info).toHaveBeenCalledWith(
        expect.stringContaining('Assinatura cancelada com sucesso. Seus benefícios continuam válidos até 10/10/2026. Seus dados foram preservados.')
      );
      expect(component.isCancelSubscriptionModalOpen()).toBe(false);
    });
  });

  describe('Cenário BDD (CARD-061): Gestão do Modo Casal / Duo em Configurações', () => {
    it('deve carregar o grupo Duo quando o plano for Duo', async () => {
      (mockAuthStore.isDuo as any).set(true);
      const mockGroup = {
        id: 'grp-duo-1',
        ownerId: 'usr-999',
        ownerEmail: 'dev@financas.com',
        ownerName: 'Carlos Silva',
        partnerId: null,
        inviteCode: 'DUO-7777',
        status: 'pending'
      };
      mockDuoService.getDuoGroupForUser.mockResolvedValue(mockGroup);

      await component.loadDuoGroup();

      expect(mockDuoService.getDuoGroupForUser).toHaveBeenCalledWith('usr-999');
      expect(component.duoGroup()).toEqual(mockGroup);
    });

    it('deve abrir o modal de pareamento via openDuoPairingModal', () => {
      component.openDuoPairingModal();
      expect(component.isDuoPairingModalOpen()).toBe(true);
    });

    it('deve fechar o modal de pareamento e recarregar dados via closeDuoPairingModal', async () => {
      component.isDuoPairingModalOpen.set(true);
      const spyLoad = vi.spyOn(component, 'loadDuoGroup').mockResolvedValue();

      await component.closeDuoPairingModal();

      expect(component.isDuoPairingModalOpen()).toBe(false);
      expect(spyLoad).toHaveBeenCalled();
    });

    it('deve renderizar o card de gerenciamento do parceiro e botão de conectar quando plano é Duo', async () => {
      (mockAuthStore.isDuo as any).set(true);
      (mockAuthStore.currentPlan as any).set('duo');
      component.setTab('subscription');
      component.duoGroup.set({
        id: 'grp-duo-1',
        ownerId: 'usr-999',
        ownerEmail: 'dev@financas.com',
        ownerName: 'Carlos Silva',
        partnerId: null,
        partnerEmail: null,
        inviteCode: 'DUO-7777',
        status: 'pending'
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const duoBtn = el.querySelector('#btn-settings-duo-connect') as HTMLButtonElement;
      expect(duoBtn).toBeTruthy();

      duoBtn.click();
      fixture.detectChanges();

      expect(component.isDuoPairingModalOpen()).toBe(true);
    });
  });
});

