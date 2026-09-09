import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from '../services/auth.service';
import { FinanceStore } from './finance.store';
import { UserProfile } from '../models/user.model';

describe('AuthStore (Signals State)', () => {
  let store: AuthStore;
  let authStateSubject: Subject<any>;
  let mockAuthService: Partial<AuthService>;
  let mockFinanceStore: any;

  const mockUser: UserProfile = {
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Philipe Teste',
    photoURL: 'https://example.com/avatar.png'
  };

  beforeEach(() => {
    authStateSubject = new Subject();
    mockAuthService = {
      authState$: vi.fn(() => authStateSubject.asObservable()),
      syncUserProfile: vi.fn(async () => mockUser),
      logout: vi.fn(async () => {})
    };

    mockFinanceStore = {
      resetState: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthService, useValue: mockAuthService },
        { provide: FinanceStore, useValue: mockFinanceStore }
      ]
    });

    store = TestBed.inject(AuthStore);
  });

  it('deve inicializar com estado de loading ativo e não autenticado', () => {
    expect(store.isLoading()).toBe(true);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.currentUser()).toBeNull();
  });

  it('Cenário BDD: deve atualizar signals reativos ao receber usuário autenticado', async () => {
    store.setUser(mockUser);

    expect(store.isAuthenticated()).toBe(true);
    expect(store.currentUser()?.uid).toBe('user-123');
    expect(store.userDisplayName()).toBe('Philipe Teste');
    expect(store.isLoading()).toBe(false);
  });

  it('deve limpar sessão e resetar o financeStore ao executar logout', async () => {
    store.setUser(mockUser);
    expect(store.isAuthenticated()).toBe(true);

    await store.logout();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.currentUser()).toBeNull();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockFinanceStore.resetState).toHaveBeenCalled();
  });

  it('Cenário BDD: deve invocar deleteAccountAndData e resetar o estado ao excluir conta', async () => {
    mockAuthService.deleteAccountAndData = vi.fn(async () => {});
    store.setUser(mockUser);
    expect(store.isAuthenticated()).toBe(true);

    await store.deleteAccount();

    expect(mockAuthService.deleteAccountAndData).toHaveBeenCalledWith('user-123');
    expect(store.isAuthenticated()).toBe(false);
    expect(store.currentUser()).toBeNull();
    expect(mockFinanceStore.resetState).toHaveBeenCalled();
  });

  it('Cenário BDD: deve resolver ensureInitialized() quando o primeiro evento de auth for emitido', async () => {
    const promise = store.ensureInitialized();

    // Emite o evento de auth
    authStateSubject.next(null);

    const isAuth = await promise;

    expect(isAuth).toBe(false);
    expect(store.isLoading()).toBe(false);
    expect(store.isInitialized()).toBe(true);
  });

  it('Cenário BDD (RBAC & Planos): deve calcular corretamente isAdmin, userRole e flags de plano', () => {
    // Caso padrão: usuário sem role explícito
    store.setUser(mockUser);
    expect(store.userRole()).toBe('user');
    expect(store.isAdmin()).toBe(false);
    expect(store.currentPlan()).toBe('free');
    expect(store.planStatus()).toBe('active');
    expect(store.isProOrDuo()).toBe(false);
    expect(store.isDuo()).toBe(false);

    // Caso Admin com plano PRO
    store.setUser({
      ...mockUser,
      role: 'admin',
      plan: 'pro',
      planStatus: 'active'
    });
    expect(store.userRole()).toBe('admin');
    expect(store.isAdmin()).toBe(true);
    expect(store.currentPlan()).toBe('pro');
    expect(store.isProOrDuo()).toBe(true);
    expect(store.isDuo()).toBe(false);

    // Caso Plano Duo
    store.setUser({
      ...mockUser,
      role: 'user',
      plan: 'duo',
      planStatus: 'active'
    });
    expect(store.userRole()).toBe('user');
    expect(store.isAdmin()).toBe(false);
    expect(store.currentPlan()).toBe('duo');
    expect(store.isProOrDuo()).toBe(true);
    expect(store.isDuo()).toBe(true);
  });

  it('Cenário BDD: deve persistir e atualizar assinatura via upgradeSubscription', async () => {
    mockAuthService.updateUserSubscription = vi.fn().mockResolvedValue(undefined);
    store.setUser(mockUser);

    await store.upgradeSubscription({
      plan: 'pro',
      planStatus: 'active',
      asaasCustomerId: 'cus_xyz',
      asaasSubscriptionId: 'sub_xyz'
    });

    expect(mockAuthService.updateUserSubscription).toHaveBeenCalledWith('user-123', {
      plan: 'pro',
      planStatus: 'active',
      asaasCustomerId: 'cus_xyz',
      asaasSubscriptionId: 'sub_xyz'
    });
    expect(store.currentPlan()).toBe('pro');
    expect(store.currentUser()?.asaasSubscriptionId).toBe('sub_xyz');
    expect(store.currentUser()?.asaasCustomerId).toBe('cus_xyz');
  });
});
