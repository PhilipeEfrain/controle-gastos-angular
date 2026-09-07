import { Injectable, signal, inject } from '@angular/core';
import { NotificationService } from './notification.service';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private readonly notificationService = inject(NotificationService);

  readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  readonly canInstall = signal<boolean>(false);
  readonly isInstalled = signal<boolean>(false);
  readonly updateAvailable = signal<boolean>(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initNetworkListeners();
    this.initInstallPromptListener();
    this.registerServiceWorker();
  }

  /**
   * Monitora a conectividade de rede do dispositivo
   */
  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.notificationService.info('Conexão restabelecida. Sincronizando com o servidor...');
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.notificationService.warning('Você está offline. As alterações serão salvas localmente.');
    });
  }

  /**
   * Captura o evento de instalação PWA (beforeinstallprompt)
   */
  private initInstallPromptListener(): void {
    if (typeof window === 'undefined') return;

    // Detecta se o app já está rodando em modo standalone (instalado)
    const isStandalone =
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)')?.matches) ||
      (typeof window.navigator !== 'undefined' && (window.navigator as unknown as { standalone?: boolean }).standalone === true);

    if (isStandalone) {
      this.isInstalled.set(true);
    }

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.canInstall.set(false);
      this.isInstalled.set(true);
      this.deferredPrompt = null;
      this.notificationService.success('Controle de Gastos instalado com sucesso!');
    });
  }

  /**
   * Registra o Service Worker customizado (/sw.js)
   */
  registerServiceWorker(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Registra o Service Worker após o carregamento inicial da página
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          this.swRegistration = reg;

          // Escuta por novas versões
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.updateAvailable.set(true);
                  this.notificationService.info('Uma nova versão do app está disponível.');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PwaService] Falha ao registrar Service Worker:', err);
        });
    });
  }

  /**
   * Dispara o diálogo nativo do navegador para instalar o PWA
   */
  async installApp(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.canInstall.set(false);
      return choice.outcome === 'accepted';
    } catch (err) {
      console.error('[PwaService] Erro ao disparar prompt de instalação:', err);
      return false;
    }
  }

  /**
   * Força a atualização do Service Worker e recarrega a página
   */
  activateUpdate(): void {
    if (this.swRegistration?.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
