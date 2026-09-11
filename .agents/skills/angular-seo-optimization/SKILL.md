---
name: angular-seo-optimization
description: Diretrizes de SEO técnico para Angular SPA, metatags dinâmicas, OpenGraph, Schema.org (JSON-LD), indexabilidade no Google, robots.txt, sitemap.xml e Core Web Vitals.
---

# Skill: SEO Técnico e Otimização para o Google (Angular SPA)

Esta skill documenta as técnicas de engenharia de SEO On-page e estruturação de dados para aplicações Angular modernas (SPA), garantindo máxima indexabilidade, snippets ricos (Rich Results) no Google e excelente performance nos Core Web Vitals.

---

## 1. Desafios de SEO em SPAs e Soluções Angular

O crawler do Google (Googlebot) executa JavaScript, mas processa páginas em duas ondas (crawling e rendering). Para garantir indexação imediata e precisa de páginas públicas (Landing Page, Preços, FAQ, Termos):

1. **Metatags Dinâmicas**: Atualização imediata de `<title>` e `<meta name="description">` a cada transição de rota usando os serviços nativos `Title` e `Meta` do Angular.
2. **Canonical URLs**: Definição dinâmica do elemento `<link rel="canonical" href="...">` para evitar conteúdo duplicado com query params ou caminhos alternativos.
3. **Open Graph & Twitter Cards**: Tags essenciais para compartilhamento rico em redes sociais (WhatsApp, LinkedIn, Twitter/X) e visualização em prévias de links.
4. **Rich Snippets com Schema.org (JSON-LD)**: Injeção de dados estruturados para que o Google entenda a aplicação como `SoftwareApplication`, exiba estrelas de avaliação e perguntas frequentes (`FAQPage`).

---

## 2. Gerenciamento de Metatags via Angular Services

Utilize os serviços nativos do `@angular/platform-browser`:

```typescript
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

  updateTags(config: SeoConfig): void {
    // 1. Título da página (Ideal: 50 a 60 caracteres)
    const formattedTitle = `${config.title} | Quinzena - Gestão Financeira`;
    this.titleService.setTitle(formattedTitle);

    // 2. Metatags básicas
    this.metaService.updateTag({ name: 'description', content: config.description });
    if (config.keywords) {
      this.metaService.updateTag({ name: 'keywords', content: config.keywords });
    }

    // 3. Robots (index/noindex)
    if (config.noIndex) {
      this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.metaService.updateTag({ name: 'robots', content: 'index, follow' });
    }

    // 4. OpenGraph
    this.metaService.updateTag({ property: 'og:title', content: formattedTitle });
    this.metaService.updateTag({ property: 'og:description', content: config.description });
    this.metaService.updateTag({ property: 'og:type', content: config.ogType || 'website' });
    if (config.canonicalUrl) {
      this.metaService.updateTag({ property: 'og:url', content: config.canonicalUrl });
      this.setCanonicalUrl(config.canonicalUrl);
    }
    if (config.ogImage) {
      this.metaService.updateTag({ property: 'og:image', content: config.ogImage });
      this.metaService.updateTag({ name: 'twitter:image', content: config.ogImage });
    }

    // 5. Twitter Cards
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: formattedTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: config.description });
  }

  private setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
```

---

## 3. Dados Estruturados Schema.org (JSON-LD)

Injete scripts do tipo `application/ld+json` para enriquecer a exibição na SERP do Google:

### Exemplo: SoftwareApplication para o Quinzena

```typescript
export function getSoftwareSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Quinzena',
    operatingSystem: 'Web, Android, iOS',
    applicationCategory: 'FinanceApplication',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'BRL'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '1240'
    },
    description: 'Aplicativo de controle financeiro quinzenal. Organize suas despesas, tributos e viagens com cálculo automático por quinzena.'
  };
}
```

### Exemplo: FAQPage (Perguntas Frequentes)

```typescript
export function getFaqSchema(faqs: { question: string; answer: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}
```

---

## 4. Arquivos de Rastreamento: robots.txt e sitemap.xml

### `robots.txt` (Localizado em `public/robots.txt`):

```txt
User-agent: *
Allow: /
Allow: /login
Allow: /register
Allow: /pricing
Allow: /terms
Allow: /privacy

# Bloquear rotas autenticadas e com dados sensíveis do usuário
Disallow: /dashboard
Disallow: /reports
Disallow: /fixed-expenses
Disallow: /taxes
Disallow: /travel
Disallow: /settings

Sitemap: https://quinzena.app/sitemap.xml
```

### `sitemap.xml` (Localizado em `public/sitemap.xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://quinzena.app/</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://quinzena.app/pricing</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://quinzena.app/login</loc>
    <lastmod>2026-09-10</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

---

## 5. Otimização de Core Web Vitals no Angular

O algoritmo do Google penaliza sites lentos. As três métricas vitais a monitorar são:

### A. LCP (Largest Contentful Paint) - Meta: < 2.5s
- **Fontes**: Use `<link rel="preconnect" href="https://fonts.googleapis.com">` e adicione `display=swap` na URL das Google Fonts.
- **Hero Image / Logotipo**: Evite `loading="lazy"` na imagem principal (Hero). Utilize `fetchpriority="high"` no elemento LCP.
- **Compressão**: Sirva imagens em formato moderno (`.webp` ou `.svg` para ícones).

### B. INP (Interaction to Next Paint) - Meta: < 200ms
- Use reatividade pura com **Signals** e `ChangeDetectionStrategy.OnPush`.
- Evite computações pesadas ou loops no thread principal durante eventos de digitação ou clique em formulários e modais.
- Desvincule listeners ou utilize observables com `takeUntilDestroyed()`.

### C. CLS (Cumulative Layout Shift) - Meta: < 0.1
- **Dimensões Reservadas**: Defina `width` e `height` explícitos em todas as tags `<img>` e `<svg>` para evitar saltos durante o carregamento.
- **Banners e Modais**: Utilize transições com `transform: scale()` ou `opacity` em vez de alterar dimensões físicas (`height: auto`).

---

## 6. Checklist de Verificação de SEO do Agente

Antes de liberar qualquer página ou funcionalidade pública:

- [ ] Tag `<title>` única, com 50-60 caracteres e palavra-chave principal no início.
- [ ] Tag `<meta name="description">` persuasiva com 140-155 caracteres e chamada clara.
- [ ] Apenas 1 único `<h1>` semântico na página, seguido de hierarquia correta (`<h2>`, `<h3>`).
- [ ] Tag canônica apontando para a URL padrão sem parâmetros de rastreamento.
- [ ] OpenGraph completo (`og:title`, `og:description`, `og:image`, `og:url`).
- [ ] Schema.org JSON-LD presente e validado no [Rich Results Test do Google](https://search.google.com/test/rich-results).
- [ ] Todas as imagens possuem atributo `alt` descritivo com contexto semântico.
- [ ] Rotas autenticadas possuem `<meta name="robots" content="noindex, nofollow">`.
