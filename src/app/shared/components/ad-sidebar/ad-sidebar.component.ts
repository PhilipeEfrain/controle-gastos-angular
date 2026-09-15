import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  computed,
  signal,
  AfterViewInit,
  PLATFORM_ID,
  OnDestroy,
  ElementRef,
  viewChildren
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthStore } from '../../../core/state/auth.store';
import { environment } from '../../../../environments/environment';

/**
 * Componente de anúncio lateral (sidebar) para Google AdSense.
 * Renderiza um anúncio vertical fixo (sticky) na lateral esquerda ou direita.
 * Visível apenas para usuários do Plano Free e em telas ≥ 1280px (xl).
 */
@Component({
  selector: 'app-ad-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-sidebar.component.html',
  styleUrl: './ad-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdSidebarComponent implements AfterViewInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly platformId = inject(PLATFORM_ID);

  readonly position = input<'left' | 'right'>('left');
  readonly slotId = input<string>(environment.adsense?.topDashboardSlot || '6818458661');
  readonly adClient = input<string>(environment.adsense?.client || 'ca-pub-8227454086945331');

  readonly isFreeUser = computed(() => !this.authStore.isProOrDuo());

  readonly isAdBlocked = signal<boolean>(false);
  readonly isScriptLoaded = signal<boolean>(false);
  readonly isVisible = signal<boolean>(false);

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isFreeUser()) {
      return;
    }

    // Só inicializa ads quando a tela é larga o suficiente
    this.mediaQuery = window.matchMedia('(min-width: 1280px)');
    this.isVisible.set(this.mediaQuery.matches);

    this.mediaListener = (e: MediaQueryListEvent) => {
      this.isVisible.set(e.matches);
      if (e.matches && !this.isScriptLoaded()) {
        this.initAdSense();
      }
    };
    this.mediaQuery.addEventListener('change', this.mediaListener);

    if (this.mediaQuery.matches) {
      this.initAdSense();
    }
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
  }

  initAdSense(): void {
    const client = this.adClient();
    if (!client) return;

    this.ensureAdSenseScript(client)
      .then(() => {
        this.isScriptLoaded.set(true);
        this.pushAd();
      })
      .catch(() => {
        this.isAdBlocked.set(true);
      });
  }

  ensureAdSenseScript(client: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.async = true;
      script.crossOrigin = 'anonymous';

      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar script do Google AdSense'));

      document.head.appendChild(script);
    });
  }

  pushAd(): void {
    try {
      if (typeof window !== 'undefined') {
        const win = window as any;
        (win.adsbygoogle = win.adsbygoogle || []).push({});
      }
    } catch {
      this.isAdBlocked.set(true);
    }
  }
}
