import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
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
export class AdBannerComponent implements AfterViewInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  private readonly platformId = inject(PLATFORM_ID);

  readonly adContainer = viewChild<ElementRef<HTMLDivElement>>('adContainer');

  readonly adKey = input<string>(environment.adsterra?.banner728x90Key || 'f44c3704756583467ecc61b994d6f80f');
  readonly mobileAdKey = input<string>(environment.adsterra?.banner300x250Key || 'dae845012d1ed3de4df9b34f05215bda');
  readonly skyscraperAdKey = input<string>(environment.adsterra?.skyscraper160x300Key || '3c670e0edde6c164bd9cc6e60437bb25');
  readonly showUpgradePrompt = input<boolean>(true);
  readonly cssClass = input<string>('');
  readonly alwaysShow = input<boolean>(false);
  readonly format = input<'auto' | 'leaderboard' | 'rectangle' | 'skyscraper'>('auto');

  // Propriedades retrocompatíveis para evitar quebras
  readonly slotId = input<string>('');
  readonly adClient = input<string>('');

  readonly upgradeClick = output<void>();

  // Apenas renderiza para usuários sem plano PRO ou DUO ativo, exceto se alwaysShow for true (ex: módulo Dividir)
  readonly isFreeUser = computed(() => !this.authStore.isProOrDuo());
  readonly shouldRender = computed(() => this.alwaysShow() || this.isFreeUser());

  readonly isAdBlocked = signal<boolean>(false);
  readonly isMobile = signal<boolean>(false);
  readonly activeFormat = signal<'leaderboard' | 'rectangle' | 'skyscraper'>('leaderboard');

  private resizeListener: (() => void) | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.shouldRender()) {
      return;
    }

    this.checkViewport();
    this.renderAdsterraBanner();

    this.resizeListener = () => {
      const prevFormat = this.activeFormat();
      this.checkViewport();
      if (prevFormat !== this.activeFormat()) {
        this.renderAdsterraBanner();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private checkViewport(): void {
    if (typeof window === 'undefined') return;

    if (this.format() === 'skyscraper') {
      this.activeFormat.set('skyscraper');
      this.isMobile.set(false);
      return;
    }

    if (this.format() === 'rectangle') {
      this.activeFormat.set('rectangle');
      this.isMobile.set(true);
      return;
    }

    if (this.format() === 'leaderboard') {
      this.activeFormat.set('leaderboard');
      this.isMobile.set(false);
      return;
    }

    // Modo 'auto': se tela < 768px, adapta para retângulo 300x250; se maior, usa leaderboard 728x90
    const isSmall = window.innerWidth < 768;
    this.isMobile.set(isSmall);
    this.activeFormat.set(isSmall ? 'rectangle' : 'leaderboard');
  }

  onUpgrade(): void {
    this.upgradeClick.emit();
  }

  /**
   * Renderiza o banner da Adsterra dentro de um iframe isolado com dimensões exatas
   * Evita poluição de escopo global no SPA e conflitos entre anúncios simultâneos
   */
  renderAdsterraBanner(): void {
    const container = this.adContainer()?.nativeElement;
    if (!container) return;

    // Remove iframes prévios para evitar duplicação em redimensionamentos
    const existingIframe = container.querySelector('iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const currentFmt = this.activeFormat();
    let key = this.adKey();
    let width = 728;
    let height = 90;

    if (currentFmt === 'skyscraper') {
      key = this.skyscraperAdKey();
      width = 160;
      height = 300;
    } else if (currentFmt === 'rectangle') {
      key = this.mobileAdKey();
      width = 300;
      height = 250;
    }

    if (!key) return;

    try {
      const iframe = document.createElement('iframe');
      iframe.width = String(width);
      iframe.height = String(height);
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.margin = '0 auto';
      iframe.style.display = 'block';
      iframe.scrolling = 'no';
      iframe.title = 'Publicidade Quinzena';
      iframe.setAttribute('data-ad-key', key);

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      background: transparent;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${key}',
      'format' : 'iframe',
      'height' : ${height},
      'width' : ${width},
      'params' : {}
    };
  <\/script>
  <script type="text/javascript" src="https://www.highrevenueformat.com/${key}/invoke.js"><\/script>
</body>
</html>`;

      iframe.srcdoc = htmlContent;

      iframe.onerror = () => {
        this.isAdBlocked.set(true);
      };

      container.appendChild(iframe);
    } catch {
      this.isAdBlocked.set(true);
    }
  }

  // Método stub retrocompatível para testes legados
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
