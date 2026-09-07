import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../state/auth.store';
import { signal } from '@angular/core';

describe('authGuard (Route Guard)', () => {
  let mockRouter: any;
  let mockAuthStore: any;

  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn((commands, extras) => ({ commands, extras }))
    };

    mockAuthStore = {
      isAuthenticated: signal(false),
      ensureInitialized: vi.fn().mockResolvedValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    });
  });

  it('Cenário BDD: deve permitir acesso quando o usuário estiver autenticado após inicialização', async () => {
    mockAuthStore.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('Cenário BDD: deve redirecionar para /auth com returnUrl quando não autenticado', async () => {
    mockAuthStore.isAuthenticated.set(false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: '/dashboard' }
    });
    expect(result).toEqual({
      commands: ['/auth'],
      extras: { queryParams: { returnUrl: '/dashboard' } }
    });
  });
});
