import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from '../services/auth.service';
import { UserProfile } from '../models/user.model';

describe('AuthStore (Signals State)', () => {
  let store: AuthStore;
  let authStateSubject: Subject<any>;
  let mockAuthService: Partial<AuthService>;

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

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthService, useValue: mockAuthService }
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

  it('deve limpar sessão ao executar logout', async () => {
    store.setUser(mockUser);
    expect(store.isAuthenticated()).toBe(true);

    await store.logout();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.currentUser()).toBeNull();
    expect(mockAuthService.logout).toHaveBeenCalled();
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
});
