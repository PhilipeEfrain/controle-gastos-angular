import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminComponent } from './admin.component';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { PwaService } from '../../core/services/pwa.service';
import { UserProfile } from '../../core/models/user.model';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AdminComponent (Painel Administrativo)', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let mockAdminService: any;
  let mockNotificationService: any;

  const mockUsers: UserProfile[] = [
    {
      uid: 'uid-admin-1',
      displayName: 'Administrador Mestre',
      email: 'admin@quinzena.app',
      photoURL: null,
      role: 'admin',
      plan: 'pro',
      planStatus: 'active',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      uid: 'uid-user-2',
      displayName: 'Carlos Silva',
      email: 'carlos@example.com',
      photoURL: null,
      role: 'user',
      plan: 'free',
      planStatus: 'active',
      createdAt: '2026-02-15T00:00:00.000Z'
    },
    {
      uid: 'uid-user-3',
      displayName: 'Maria Santos',
      email: 'maria@example.com',
      photoURL: null,
      role: 'user',
      plan: 'duo',
      planStatus: 'active',
      createdAt: '2026-03-10T00:00:00.000Z'
    }
  ];

  beforeEach(async () => {
    mockAdminService = {
      getAllUsers: vi.fn().mockResolvedValue(mockUsers),
      updateUserPlan: vi.fn().mockResolvedValue(undefined),
      updateUserRole: vi.fn().mockResolvedValue(undefined),
      calculateSaaSMetrics: vi.fn((users: UserProfile[]) => {
        const total = users.length;
        const free = users.filter(u => (u.plan || 'free') === 'free').length;
        const pro = users.filter(u => u.plan === 'pro').length;
        const duo = users.filter(u => u.plan === 'duo').length;
        const paid = pro + duo;
        const mrr = (pro * 9.90) + (duo * 19.90);
        return {
          totalUsers: total,
          freeUsers: free,
          proUsers: pro,
          duoUsers: duo,
          paidUsers: paid,
          estimatedMRR: Number(mrr.toFixed(2)),
          conversionRate: total > 0 ? Number(((paid / total) * 100).toFixed(1)) : 0
        };
      }),
      getAsaasConfig: vi.fn().mockResolvedValue({
        environment: 'sandbox',
        apiKey: '$aact_test_key_12345',
        webhookSecret: 'whsec_test_secret',
        walletId: 'wal_123',
        isActive: true,
        lastTestedAt: '2026-03-01T12:00:00.000Z',
        lastTestStatus: 'success',
        lastTestMessage: 'Conexão bem-sucedida'
      }),
      saveAsaasConfig: vi.fn().mockResolvedValue(undefined),
      testAsaasConnection: vi.fn().mockResolvedValue({ success: true, message: 'Conectado com sucesso!' })
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    };

    const mockAuthStore = {
      currentUser: signal(mockUsers[0]),
      isAuthenticated: signal(true),
      isAdmin: signal(true),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    const mockAuthService = {
      logout: vi.fn().mockResolvedValue(undefined)
    };

    const mockThemeService = {
      currentTheme: signal('dark'),
      isDark: signal(true),
      toggleTheme: vi.fn()
    };

    const mockPwaService = {
      isOnline: signal(true),
      canInstall: signal(false),
      installApp: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: mockAdminService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: PwaService, useValue: mockPwaService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve inicializar e carregar usuários e KPIs', async () => {
    await fixture.whenStable();
    expect(mockAdminService.getAllUsers).toHaveBeenCalled();
    expect(component.users().length).toBe(3);
    expect(component.metrics().totalUsers).toBe(3);
    expect(component.metrics().paidUsers).toBe(2);
    expect(component.metrics().estimatedMRR).toBe(29.80);
  });

  it('Cenário BDD 1: deve renderizar os 4 cards de KPIs com valores calculados', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const totalEl = fixture.nativeElement.querySelector('#kpi-total-users');
    const freeEl = fixture.nativeElement.querySelector('#kpi-free-users');
    const paidEl = fixture.nativeElement.querySelector('#kpi-paid-users');
    const mrrEl = fixture.nativeElement.querySelector('#kpi-mrr-value');

    expect(totalEl.textContent.trim()).toBe('3');
    expect(freeEl.textContent.trim()).toBe('1');
    expect(paidEl.textContent.trim()).toBe('2');
    expect(mrrEl.textContent).toContain('29,80');
  });

  it('Cenário BDD 2: deve filtrar usuários por termo de busca reativo', async () => {
    await fixture.whenStable();

    component.searchTerm.set('Carlos');
    fixture.detectChanges();

    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].displayName).toBe('Carlos Silva');

    component.clearSearch();
    expect(component.filteredUsers().length).toBe(3);
  });

  it('Cenário BDD 3: deve filtrar usuários por plano de assinatura', async () => {
    await fixture.whenStable();

    component.setPlanFilter('pro');
    fixture.detectChanges();

    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].uid).toBe('uid-admin-1');

    component.setPlanFilter('free');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].uid).toBe('uid-user-2');
  });

  it('Cenário BDD 4: deve abrir modal, alterar plano do usuário e atualizar estado reativo', async () => {
    await fixture.whenStable();

    const targetUser = mockUsers[1]; // Carlos Silva (Free)
    component.openEditModal(targetUser);

    expect(component.selectedUserForEdit()).toEqual(targetUser);
    expect(component.editPlan()).toBe('free');

    // Altera para Pro
    component.editPlan.set('pro');
    await component.saveUserChanges();

    expect(mockAdminService.updateUserPlan).toHaveBeenCalledWith('uid-user-2', 'pro', 'active');
    expect(mockNotificationService.success).toHaveBeenCalled();
    expect(component.selectedUserForEdit()).toBeNull();

    // Verifica que o estado local foi atualizado
    const updatedUser = component.users().find(u => u.uid === 'uid-user-2');
    expect(updatedUser?.plan).toBe('pro');
  });

  describe('CARD-032: Painel de Integração Asaas', () => {
    it('Cenário BDD 5: deve alternar entre a aba de Visão Geral e a aba de Integração Asaas', async () => {
      await fixture.whenStable();
      expect(component.activeTab()).toBe('overview');

      component.setTab('asaas');
      fixture.detectChanges();
      expect(component.activeTab()).toBe('asaas');

      const asaasSection = fixture.nativeElement.querySelector('.asaas-config-section');
      expect(asaasSection).toBeTruthy();
    });

    it('Cenário BDD 6: deve carregar configurações salvas do Asaas no ngOnInit', async () => {
      await fixture.whenStable();
      expect(mockAdminService.getAsaasConfig).toHaveBeenCalled();
      expect(component.asaasEnvironment()).toBe('sandbox');
      expect(component.asaasApiKey()).toBe('$aact_test_key_12345');
      expect(component.asaasWebhookSecret()).toBe('whsec_test_secret');
      expect(component.asaasIsActive()).toBe(true);
    });

    it('Cenário BDD 7: deve alternar a visibilidade da chave de API e do segredo de webhook', () => {
      expect(component.showApiKey()).toBe(false);
      component.toggleShowApiKey();
      expect(component.showApiKey()).toBe(true);
      component.toggleShowApiKey();
      expect(component.showApiKey()).toBe(false);

      expect(component.showWebhookSecret()).toBe(false);
      component.toggleShowWebhookSecret();
      expect(component.showWebhookSecret()).toBe(true);
    });

    it('Cenário BDD 8: deve executar teste de conectividade com a API Asaas', async () => {
      await fixture.whenStable();
      component.asaasApiKey.set('$aact_test_key_12345');
      component.asaasEnvironment.set('sandbox');

      await component.testAsaasConnection();

      expect(mockAdminService.testAsaasConnection).toHaveBeenCalledWith('$aact_test_key_12345', 'sandbox');
      expect(mockNotificationService.success).toHaveBeenCalledWith('Conexão com a API Asaas estabelecida com sucesso!');
      expect(component.connectionTestResult()?.success).toBe(true);
    });

    it('Cenário BDD 9: deve salvar novas credenciais e configurações com sucesso', async () => {
      await fixture.whenStable();
      component.asaasEnvironment.set('production');
      component.asaasApiKey.set('$aact_live_token_999999999');
      component.asaasWebhookSecret.set('whsec_live_secret_888');

      await component.saveAsaasConfig();

      expect(mockAdminService.saveAsaasConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
          apiKey: '$aact_live_token_999999999',
          webhookSecret: 'whsec_live_secret_888',
          isActive: true
        })
      );
      expect(mockNotificationService.success).toHaveBeenCalledWith('Configurações do Asaas salvas com sucesso no Firebase!');
    });
  });
});

