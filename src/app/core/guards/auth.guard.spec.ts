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
      isAuthenticated: signal(false)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    });
  });

  it('Cenário BDD: deve permitir acesso quando o usuário estiver autenticado', () => {
    mockAuthStore.isAuthenticated.set(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });

  it('Cenário BDD: deve redirecionar para /auth com returnUrl quando não autenticado', () => {
    mockAuthStore.isAuthenticated.set(false);

    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: '/dashboard' }
    });
  });
});
