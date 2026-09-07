import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

/**
 * Route Guard para proteção de rotas privadas (ex: /dashboard, /tributos).
 * Aguarda a inicialização assíncrona do Firebase Auth antes de tomar a decisão,
 * prevenindo redirecionamentos indevidos ao recarregar a página (F5).
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.ensureInitialized();

  if (authStore.isAuthenticated()) {
    return true;
  }

  // Redireciona para /auth preservando a URL de destino
  return router.createUrlTree(['/auth'], {
    queryParams: { returnUrl: state.url }
  });
};
