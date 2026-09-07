import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Route Guard para proteção de rotas públicas de autenticação (ex: /auth).
 * Aguarda a inicialização assíncrona do Firebase Auth e redireciona usuários já autenticados para /dashboard.
 */
export const publicGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.ensureInitialized();

  if (!authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
