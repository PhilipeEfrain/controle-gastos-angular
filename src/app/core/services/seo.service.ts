import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noIndex?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly defaultTitle = 'Quinzena — Controle de Gastos e Finanças Quinzenais';
  private readonly defaultDescription =
    'Quinzena: o controle financeiro para quem recebe dia 31 e dia 15. Organize pagamentos por quinzena, parcelamentos e viagens sem estresse. Comece grátis!';
  private readonly defaultOgImage = 'https://quinzena.app/icons/icon-512.png';

  updateTags(config: Partial<SeoConfig>): void {
    const pageTitle = config.title
      ? `${config.title} | Quinzena`
      : this.defaultTitle;
    const pageDescription = config.description || this.defaultDescription;

    // 1. Título da Página
    this.titleService.setTitle(pageTitle);

    // 2. Metatags básicas
    this.metaService.updateTag({ name: 'description', content: pageDescription });
    if (config.keywords) {
      this.metaService.updateTag({ name: 'keywords', content: config.keywords });
    }

    // 3. Robots
    if (config.noIndex) {
      this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.metaService.updateTag({ name: 'robots', content: 'index, follow' });
    }

    // 4. OpenGraph
    this.metaService.updateTag({ property: 'og:title', content: pageTitle });
    this.metaService.updateTag({ property: 'og:description', content: pageDescription });
    this.metaService.updateTag({ property: 'og:type', content: config.ogType || 'website' });
    this.metaService.updateTag({
      property: 'og:image',
      content: config.ogImage || this.defaultOgImage
    });

    if (config.canonicalUrl) {
      this.metaService.updateTag({ property: 'og:url', content: config.canonicalUrl });
      this.setCanonicalUrl(config.canonicalUrl);
    }

    // 5. Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: pageTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: pageDescription });
    this.metaService.updateTag({
      name: 'twitter:image',
      content: config.ogImage || this.defaultOgImage
    });
  }

  private setCanonicalUrl(url: string): void {
    try {
      let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
      if (!link) {
        link = this.document.createElement('link');
        link.setAttribute('rel', 'canonical');
        this.document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    } catch {
      // Ignorar erros em ambiente SSR/teste caso document não possua querySelector completo
    }
  }
}
