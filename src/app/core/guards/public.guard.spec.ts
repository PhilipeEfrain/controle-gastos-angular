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

  it('Cenário BDD: deve permitir acesso à rota pública quando o usuário NÃO estiver autenticado após inicialização', async () => {
    mockAuthStore.isAuthenticated.set(false);

    const result = await TestBed.runInInjectionContext(() =>
      publicGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('Cenário BDD: deve redirecionar para /dashboard quando o usuário já estiver autenticado', async () => {
    mockAuthStore.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      publicGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toEqual({ commands: ['/dashboard'] });
  });
});
