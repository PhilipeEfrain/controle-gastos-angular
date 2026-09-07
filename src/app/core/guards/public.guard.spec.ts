import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { publicGuard } from './public.guard';
import { AuthStore } from '../state/auth.store';
import { signal } from '@angular/core';

describe('publicGuard (Route Guard)', () => {
  let mockRouter: any;
  let mockAuthStore: any;

  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn(commands => ({ commands }))
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

  it('Cenário BDD: deve permitir acesso à rota pública quando o usuário NÃO estiver autenticado', () => {
    mockAuthStore.isAuthenticated.set(false);

    const result = TestBed.runInInjectionContext(() =>
      publicGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });

  it('Cenário BDD: deve redirecionar para /dashboard quando o usuário já estiver autenticado', () => {
    mockAuthStore.isAuthenticated.set(true);

    TestBed.runInInjectionContext(() =>
      publicGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });
});
