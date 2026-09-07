import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';
import { NotificationService } from '../services/notification.service';

/**
 * Route Guard para proteção de rotas administrativas (/admin/*).
 * Garante que apenas usuários autenticados com papel 'admin' tenham acesso.
 * Redireciona usuários não autorizados para /dashboard exibindo notificação de erro.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  await authStore.ensureInitialized();

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (!authStore.isAdmin()) {
    notificationService.error('Acesso restrito a administradores da plataforma.');
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
