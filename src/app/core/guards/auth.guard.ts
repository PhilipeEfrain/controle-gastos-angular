import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Route Guard para proteção de rotas privadas (ex: /dashboard, /tributos).
 * Redireciona usuários não autenticados para /auth.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  // Redireciona para /auth preservando a URL de destino
  return router.createUrlTree(['/auth'], {
    queryParams: { returnUrl: state.url }
  });
};
