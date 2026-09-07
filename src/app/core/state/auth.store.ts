import { Injectable, signal, computed, inject } from '@angular/core';
import { UserProfile } from '../models/user.model';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private authService = inject(AuthService);

  // Estados Reativos Privados (Signals)
  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _isInitialized = signal<boolean>(false);

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
        }
        this._isLoading.set(false);
        this._isInitialized.set(true);
      },
      error: () => {
        this._currentUser.set(null);
        this._isLoading.set(false);
        this._isInitialized.set(true);
      }
    });
  }

  // Métodos de Mutação de Estado
  setUser(user: UserProfile | null): void {
    this._currentUser.set(user);
    this._isLoading.set(false);
    this._isInitialized.set(true);
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  async logout(): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.authService.logout();
      this._currentUser.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }
}
