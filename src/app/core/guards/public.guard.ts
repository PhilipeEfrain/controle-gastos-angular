import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Route Guard para proteção de rotas públicas de autenticação (ex: /auth).
 * Redireciona usuários já autenticados diretamente para /dashboard.
 */
export const publicGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
