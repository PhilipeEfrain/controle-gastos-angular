import { Injectable, signal, computed, inject } from '@angular/core';
import { UserProfile } from '../models/user.model';
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

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  async logout(): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.authService.logout();
      this._currentUser.set(null);
      this.financeStore.resetState();
    } finally {
      this._isLoading.set(false);
    }
  }
}
