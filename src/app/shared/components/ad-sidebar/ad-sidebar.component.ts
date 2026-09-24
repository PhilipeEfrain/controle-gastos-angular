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
  viewChild
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthStore } from '../../../core/state/auth.store';
import { environment } from '../../../../environments/environment';

/**
 * Componente de anúncio lateral (sidebar) para Adsterra.
 * Renderiza um banner 300x250 fixo na lateral esquerda ou direita em telas ultra-wide (2xl ≥ 1536px).
 * Visível apenas para usuários do Plano Free.
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

  readonly adContainer = viewChild<ElementRef<HTMLDivElement>>('adContainer');

  readonly position = input<'left' | 'right'>('left');
  readonly adKey = input<string>(environment.adsterra?.banner300x250Key || 'dae845012d1ed3de4df9b34f05215bda');

  // Propriedades retrocompatíveis
  readonly slotId = input<string>('');
  readonly adClient = input<string>('');

  readonly isFreeUser = computed(() => !this.authStore.isProOrDuo());

  readonly isAdBlocked = signal<boolean>(false);
  readonly isVisible = signal<boolean>(false);

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isFreeUser()) {
      return;
    }

    // Visível em telas amplas (≥ 1536px para acomodar barras de 300px nas laterais sem sobrepor conteúdo)
    this.mediaQuery = window.matchMedia('(min-width: 1536px)');
    this.isVisible.set(this.mediaQuery.matches);

    this.mediaListener = (e: MediaQueryListEvent) => {
      this.isVisible.set(e.matches);
      if (e.matches) {
        setTimeout(() => this.renderAdsterraBanner(), 50);
      }
    };
    this.mediaQuery.addEventListener('change', this.mediaListener);

    if (this.mediaQuery.matches) {
      this.renderAdsterraBanner();
    }
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaListener && typeof window !== 'undefined') {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
  }

  renderAdsterraBanner(): void {
    const container = this.adContainer()?.nativeElement;
    if (!container) return;

    const existingIframe = container.querySelector('iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const key = this.adKey();
    if (!key) return;

    try {
      const iframe = document.createElement('iframe');
      iframe.width = '300';
      iframe.height = '250';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.margin = '0 auto';
      iframe.style.display = 'block';
      iframe.scrolling = 'no';
      iframe.title = `Publicidade Lateral ${this.position()}`;
      iframe.setAttribute('data-ad-key', key);

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    body { margin: 0; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; background: transparent; }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${key}',
      'format' : 'iframe',
      'height' : 250,
      'width' : 300,
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
