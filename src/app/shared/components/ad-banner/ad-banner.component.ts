import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
  AfterViewInit,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthStore } from '../../../core/state/auth.store';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ad-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-banner.component.html',
  styleUrl: './ad-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdBannerComponent implements AfterViewInit {
  private readonly authStore = inject(AuthStore);
  private readonly platformId = inject(PLATFORM_ID);

  readonly slotId = input<string>(environment.adsense?.topDashboardSlot || '1234567890');
  readonly adClient = input<string>(environment.adsense?.client || 'ca-pub-0000000000000000');
  readonly showUpgradePrompt = input<boolean>(true);

  readonly upgradeClick = output<void>();

  // Apenas renderiza para usuários sem plano PRO ou DUO ativo
  readonly isFreeUser = computed(() => !this.authStore.isProOrDuo());

  readonly isAdBlocked = signal<boolean>(false);
  readonly isScriptLoaded = signal<boolean>(false);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isFreeUser()) {
      return;
    }

    this.initAdSense();
  }

  onUpgrade(): void {
    this.upgradeClick.emit();
  }

  /**
   * Injeta o script oficial do Google AdSense assincronamente e aciona o anúncio (CARD-054)
   */
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

  /**
   * Garante que o script oficial do AdSense seja incluído apenas uma vez no DOM
   */
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
      script.onerror = () => reject(new Error('Falha ao carregar script do Google AdSense (possível bloqueador)'));

      document.head.appendChild(script);
    });
  }

  /**
   * Executa push para a fila global do AdSense com tratamento de exceções
   */
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
