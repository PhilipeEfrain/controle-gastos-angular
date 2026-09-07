import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthStore } from '../state/auth.store';
import { NotificationService } from '../services/notification.service';
import { signal } from '@angular/core';

describe('adminGuard (RBAC Route Guard)', () => {
  let mockRouter: any;
  let mockAuthStore: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn((commands, extras) => ({ commands, extras }))
    };

    mockAuthStore = {
      isAuthenticated: signal(false),
      isAdmin: signal(false),
      ensureInitialized: vi.fn().mockResolvedValue(true)
    };

    mockNotificationService = {
      error: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    });
  });

  it('Cenário BDD 1: deve redirecionar para /auth com returnUrl se o usuário não estiver autenticado', async () => {
    mockAuthStore.isAuthenticated.set(false);
    mockAuthStore.isAdmin.set(false);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: '/admin' }
    });
    expect(result).toEqual({
      commands: ['/auth'],
      extras: { queryParams: { returnUrl: '/admin' } }
    });
  });

  it('Cenário BDD 2: deve bloquear e redirecionar para /dashboard se usuário autenticado não for admin', async () => {
    mockAuthStore.isAuthenticated.set(true);
    mockAuthStore.isAdmin.set(false);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(mockNotificationService.error).toHaveBeenCalledWith('Acesso restrito a administradores da plataforma.');
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toEqual({
      commands: ['/dashboard'],
      extras: undefined
    });
  });

  it('Cenário BDD 3: deve liberar acesso se o usuário autenticado for admin', async () => {
    mockAuthStore.isAuthenticated.set(true);
    mockAuthStore.isAdmin.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(mockAuthStore.ensureInitialized).toHaveBeenCalled();
    expect(mockNotificationService.error).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
