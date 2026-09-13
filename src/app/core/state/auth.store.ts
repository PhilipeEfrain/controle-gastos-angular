import { Injectable, signal, computed, inject } from '@angular/core';
import { UserProfile, PlanType, PlanStatus } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { FinanceStore } from './finance.store';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private authService = inject(AuthService);
  private financeStore = inject(FinanceStore);

  // Estados Reativos Privados (Signals)
  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _isInitialized = signal<boolean>(false);

  // Controle de Promessa para Espera Assíncrona na Inicialização do Firebase Auth
  private initResolve?: (value: boolean) => void;
  private readonly initPromise: Promise<boolean> = new Promise(resolve => {
    this.initResolve = resolve;
  });

  // Seletores Públicos (ReadOnly Signals)
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  // Valor Computado Derivado
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly userDisplayName = computed(() => this._currentUser()?.displayName ?? 'Usuário');
  readonly userPhotoURL = computed(() => this._currentUser()?.photoURL ?? null);
  readonly userRole = computed(() => this._currentUser()?.role ?? 'user');
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly currentPlan = computed(() => this._currentUser()?.plan ?? 'free');
  readonly planStatus = computed(() => this._currentUser()?.planStatus ?? 'active');
  readonly isProOrDuo = computed(() => {
    const user = this._currentUser();
    const plan = user?.plan;
    if (plan !== 'pro' && plan !== 'duo') {
      return false;
    }

    const status = user?.planStatus ?? 'active';
    if (status === 'canceled') {
      if (!user?.planExpiresAt) {
        return false;
      }
      const expDate = new Date(user.planExpiresAt);
      return !isNaN(expDate.getTime()) && new Date() <= expDate;
    }

    if (status === 'past_due') {
      if (!user?.gracePeriodExpiresAt) {
        return false;
      }
      const graceDate = new Date(user.gracePeriodExpiresAt);
      return !isNaN(graceDate.getTime()) && new Date() <= graceDate;
    }

    return true;
  });

  readonly isGracePeriodActive = computed(() => {
    const user = this._currentUser();
    const plan = user?.plan;
    if ((plan === 'pro' || plan === 'duo') && user?.planStatus === 'past_due' && user?.gracePeriodExpiresAt) {
      const graceDate = new Date(user.gracePeriodExpiresAt);
      return !isNaN(graceDate.getTime()) && new Date() <= graceDate;
    }
    return false;
  });

  readonly isPlanSuspended = computed(() => {
    const user = this._currentUser();
    const plan = user?.plan;
    if (plan !== 'pro' && plan !== 'duo') {
      return false;
    }
    const status = user?.planStatus;
    if (status === 'canceled') {
      if (!user?.planExpiresAt) {
        return true;
      }
      const expDate = new Date(user.planExpiresAt);
      return isNaN(expDate.getTime()) || new Date() > expDate;
    }
    if (status === 'past_due') {
      if (!user?.gracePeriodExpiresAt) {
        return true;
      }
      const graceDate = new Date(user.gracePeriodExpiresAt);
      return isNaN(graceDate.getTime()) || new Date() > graceDate;
    }
    return false;
  });

  readonly gracePeriodDeadlineFormatted = computed(() => {
    const expiresAt = this._currentUser()?.gracePeriodExpiresAt;
    if (!expiresAt) {
      return '';
    }
    const date = new Date(expiresAt);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  });

  readonly planExpiresAtFormatted = computed(() => {
    const expiresAt = this._currentUser()?.planExpiresAt;
    if (!expiresAt) {
      return '';
    }
    const date = new Date(expiresAt);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  });

  readonly scheduledPlan = computed(() => this._currentUser()?.scheduledPlan ?? null);
  readonly scheduledPlanDate = computed(() => this._currentUser()?.scheduledPlanDate ?? null);
  readonly hasScheduledDowngrade = computed(() => !!this._currentUser()?.scheduledPlan);

  readonly scheduledPlanDateFormatted = computed(() => {
    const expiresAt = this._currentUser()?.scheduledPlanDate;
    if (!expiresAt) {
      return '';
    }
    const date = new Date(expiresAt);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  });

  readonly isCanceledWithAccess = computed(() => {
    const user = this._currentUser();
    if (user?.planStatus !== 'canceled' || (user?.plan !== 'pro' && user?.plan !== 'duo')) {
      return false;
    }
    if (!user.planExpiresAt) {
      return false;
    }
    const expDate = new Date(user.planExpiresAt);
    return !isNaN(expDate.getTime()) && new Date() <= expDate;
  });

  readonly isDuo = computed(() => this._currentUser()?.plan === 'duo');

  constructor() {
    this.initAuthListener();
  }

  /**
   * Aguarda a resolução da primeira checagem de sessão do Firebase Auth (evita perda de sessão no F5)
   */
  async ensureInitialized(): Promise<boolean> {
    if (this._isInitialized()) {
      return this.isAuthenticated();
    }
    await this.initPromise;
    return this.isAuthenticated();
  }

  /**
   * Monitora em tempo real o estado de sessão do Firebase Auth
   */
  private initAuthListener(): void {
    if (typeof window !== 'undefined') {
      try {
        const mockUserJson = localStorage.getItem('__E2E_AUTH_USER__');
        if (mockUserJson) {
          const profile = JSON.parse(mockUserJson) as UserProfile;
          this._currentUser.set(profile);
          this._isLoading.set(false);
          this._isInitialized.set(true);
          if (this.initResolve) {
            this.initResolve(true);
          }
          return;
        }
      } catch {
        // Fallback para o listener normal do Firebase
      }
    }

    this.authService.authState$().subscribe({
      next: async user => {
        if (user) {
          try {
            const profile = await this.authService.syncUserProfile(user);
            this._currentUser.set(profile);
          } catch {
            this._currentUser.set({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Usuário',
              photoURL: user.photoURL
            });
          }
        } else {
          this._currentUser.set(null);
          this.financeStore.resetState();
        }
        this._isLoading.set(false);
        this._isInitialized.set(true);
        if (this.initResolve) {
          this.initResolve(!!this._currentUser());
        }
      },
      error: () => {
        this._currentUser.set(null);
        this.financeStore.resetState();
        this._isLoading.set(false);
        this._isInitialized.set(true);
        if (this.initResolve) {
          this.initResolve(false);
        }
      }
    });
  }

  // Métodos de Mutação de Estado
  setUser(user: UserProfile | null): void {
    this._currentUser.set(user);
    if (!user) {
      this.financeStore.resetState();
    }
    this._isLoading.set(false);
    this._isInitialized.set(true);
    if (this.initResolve) {
      this.initResolve(!!user);
    }
  }

  updateCurrentUser(data: Partial<UserProfile>): void {
    const current = this._currentUser();
    if (current) {
      this._currentUser.set({
        ...current,
        ...data,
        preferences: data.preferences ? { ...current.preferences, ...data.preferences } as any : current.preferences
      });
    }
  }

  /**
   * Atualiza a assinatura do usuário tanto em memória quanto no Firestore para persistência definitiva (resistente ao F5)
   */
  async upgradeSubscription(subscriptionData: {
    plan: PlanType;
    planStatus: PlanStatus;
    asaasCustomerId?: string;
    asaasSubscriptionId?: string;
    planExpiresAt?: string | null;
  }): Promise<void> {
    const user = this._currentUser();
    if (!user) {
      throw new Error('Usuário não autenticado para atualização de plano.');
    }

    await this.authService.updateUserSubscription(user.uid, subscriptionData);

    const resolvedExpiresAt = subscriptionData.planExpiresAt !== undefined
      ? subscriptionData.planExpiresAt
      : (subscriptionData.planStatus === 'active'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : user.planExpiresAt);

    this._currentUser.set({
      ...user,
      plan: subscriptionData.plan,
      planStatus: subscriptionData.planStatus,
      asaasCustomerId: subscriptionData.asaasCustomerId ?? user.asaasCustomerId,
      asaasSubscriptionId: subscriptionData.asaasSubscriptionId ?? user.asaasSubscriptionId,
      planExpiresAt: resolvedExpiresAt,
      gracePeriodExpiresAt: subscriptionData.planStatus === 'active' ? null : user.gracePeriodExpiresAt,
      scheduledPlan: null,
      scheduledPlanDate: null
    });
  }

  /**
   * Solicita o cancelamento da assinatura recorrente do usuário.
   * O status é alterado para 'canceled', mantendo o acesso até planExpiresAt.
   */
  async cancelSubscription(): Promise<void> {
    const user = this._currentUser();
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    await this.authService.cancelUserSubscription(user.uid, user.asaasSubscriptionId || undefined);

    this._currentUser.set({
      ...user,
      planStatus: 'canceled'
    });
  }

  /**
   * Agenda o downgrade de plano para a próxima data de renovação.
   * O usuário mantém seu plano e benefícios atuais até lá.
   */
  async scheduleDowngrade(targetPlan: PlanType): Promise<void> {
    const user = this._currentUser();
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const effectiveDate = user.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.authService.schedulePlanDowngrade(user.uid, targetPlan, effectiveDate);

    this._currentUser.set({
      ...user,
      scheduledPlan: targetPlan,
      scheduledPlanDate: effectiveDate
    });
  }

  /**
   * Cancela o downgrade agendado mantendo o plano e ciclo atual
   */
  async cancelScheduledDowngrade(): Promise<void> {
    const user = this._currentUser();
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    await this.authService.cancelScheduledDowngrade(user.uid);

    this._currentUser.set({
      ...user,
      scheduledPlan: null,
      scheduledPlanDate: null
    });
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  async logout(): Promise<void> {
    this._isLoading.set(true);
    try {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('__E2E_AUTH_USER__');
        } catch {}
      }
      await this.authService.logout();
      this._currentUser.set(null);
      this.financeStore.resetState();
    } finally {
      this._isLoading.set(false);
    }
  }

  async deleteAccount(): Promise<void> {
    const user = this._currentUser();
    if (!user) return;

    this._isLoading.set(true);
    try {
      await this.authService.deleteAccountAndData(user.uid);
      this._currentUser.set(null);
      this.financeStore.resetState();
    } finally {
      this._isLoading.set(false);
    }
  }
}
