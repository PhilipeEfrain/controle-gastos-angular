import { Injectable, signal } from '@angular/core';
import { ToastNotification, ToastType } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  readonly notifications = signal<ToastNotification[]>([]);

  /**
   * Exibe uma nova notificação Toast
   */
  show(message: string, type: ToastType = 'info', duration: number = 4000): string {
    const id = crypto.randomUUID();
    const notification: ToastNotification = {
      id,
      type,
      message,
      duration,
      timestamp: Date.now()
    };

    this.notifications.update(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  /**
   * Atalho para notificação de sucesso (verde)
   */
  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  /**
   * Atalho para notificação de erro (vermelho)
   */
  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration);
  }

  /**
   * Atalho para notificação de aviso (amarelo)
   */
  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  /**
   * Atalho para notificação informativa (azul)
   */
  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  /**
   * Remove uma notificação específica pelo ID
   */
  dismiss(id: string): void {
    this.notifications.update(prev => prev.filter(n => n.id !== id));
  }

  /**
   * Limpa todas as notificações ativas
   */
  clear(): void {
    this.notifications.set([]);
  }
}
