---
name: google-analytics-ga4
description: Melhores práticas, taxonomia de eventos, Consent Mode v2, Firebase Analytics Modular SDK e GA4 Data API para Angular moderno.
---

# Skill: Google Analytics 4 (GA4) & Firebase Analytics no Angular

Esta skill define as melhores práticas, padrões de engenharia e governança de dados para rastreamento de telemetria, conversões SaaS e comportamento de usuários utilizando **Firebase Analytics Modular SDK** e **GA4** em aplicações Angular modernas.

---

## 1. Padrão Arquitetural: `AnalyticsService` Centralizado

Nunca chame `logEvent` diretamente em componentes de tela. Centralize todo o rastreamento em um serviço injetável com tipagem estrita e resiliência a ambientes de teste e SSR.

### Implementação do Serviço (`src/app/core/services/analytics.service.ts`)

```typescript
import { Injectable, inject, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  getAnalytics,
  isSupported,
  logEvent,
  setConsent,
  setUserId,
  setUserProperties,
  Analytics
} from 'firebase/analytics';
import { FirebaseService } from './firebase.service';
import { environment } from '../../../environments/environment';

export interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private analytics: Analytics | null = null;
  private isInitialized = false;

  constructor() {
    this.initAnalytics();
  }

  private async initAnalytics(): Promise<void> {
    try {
      // 1. Verifica suporte a analytics (cookies habilitados, indexedDB e ambiente browser)
      const supported = await isSupported();
      if (!supported) return;

      // 2. Inicializa o Analytics no ecossistema Firebase
      this.analytics = getAnalytics(this.firebaseService.app);
      this.isInitialized = true;

      // 3. Rastreamento automático de rotas SPA
      this.listenToRouteChanges();
    } catch {
      // Falha silenciosa para não degradar a experiência do usuário
    }
  }

  private listenToRouteChanges(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  /** Rastreia visualizações de tela / páginas */
  trackPageView(pagePath: string, pageTitle?: string): void {
    if (!this.analytics || !environment.production) return;
    this.ngZone.runOutsideAngular(() => {
      logEvent(this.analytics!, 'page_view', {
        page_path: pagePath,
        page_title: pageTitle || document.title
      });
    });
  }

  /** Rastreia eventos de interação com parâmetros sanitizados */
  trackEvent(eventName: string, params?: EventParams): void {
    if (!this.analytics || !environment.production) return;
    this.ngZone.runOutsideAngular(() => {
      logEvent(this.analytics!, eventName, params);
    });
  }

  /** Associa o identificador anônimo do usuário */
  setUser(userId: string | null): void {
    if (!this.analytics) return;
    setUserId(this.analytics, userId);
  }

  /** Atualiza propriedades do usuário (ex: plano, tema) */
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    if (!this.analytics) return;
    setUserProperties(this.analytics, properties);
  }

  /** Atualiza o consentimento de cookies e telemetria (Consent Mode v2) */
  updateConsent(granted: boolean): void {
    const status = granted ? 'granted' : 'denied';
    setConsent({
      analytics_storage: status,
      ad_storage: status,
      ad_user_data: status,
      ad_personalization: status
    });
  }
}
```

---

## 2. Taxonomia Oficial de Eventos do Quinzena (SaaS Financeiro)

Siga rigorosamente a convenção do GA4:
- Nomes em `snake_case` com até 40 caracteres.
- Parâmetros em `snake_case`.
- Máximo de 25 parâmetros por evento.

### A. Funil de Aquisição & Landing Page
| Evento | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `page_view` | `page_path`, `page_title` | Visita a qualquer rota pública ou privada |
| `click_cta_hero` | `cta_label`, `destination` | Clique no botão de conversão principal da Landing |
| `view_pricing_plans` | `source_section` | Rolagem ou visualização da grade de preços |

### B. Ativação & Onboarding
| Evento | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `sign_up` | `method` (`google` ou `email_password`) | Novo cadastro de usuário concluído |
| `login` | `method` (`google` ou `email_password`) | Autenticação com sucesso |
| `onboarding_step_complete` | `step_number` (1..3), `step_name` | Conclusão de uma etapa do checklist guiado |
| `onboarding_completed` | `total_steps: 3`, `duration_seconds` | Conclusão de 100% dos passos de onboarding |
| `onboarding_dismissed` | `completed_count` | Guia dispensado manualmente pelo usuário |

### C. Retenção & Core Loop Financeiro
| Evento | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `create_expense` | `expense_type` (`fixa` ou `variavel`), `quinzena` (1 ou 2), `has_attachment` | Lançamento de despesa |
| `toggle_expense_paid` | `new_status` (`paid` ou `pending`) | Quitação rápida em 1 clique |
| `create_installment` | `installments_count` | Registro de despesa parcelada |
| `navigate_cycle` | `target_month` (`YYYY-MM`) | Navegação de mês/ciclo |
| `export_report` | `format` (`pdf` ou `excel`) | Exportação de planilha ou relatório |
| `duo_pairing_attempt` | `action` (`generate_code` ou `link_partner`) | Utilização de conta conjunta |

### D. Monetização & Checkout PRO (Asaas)
| Evento | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `view_subscription_modal` | `trigger` (`limit_reached`, `navbar`, `settings`) | Abertura do modal de assinatura |
| `select_billing_cycle` | `cycle` (`mensal` ou `anual`) | Seleção da periodicidade |
| `begin_checkout` | `plan: 'pro'`, `payment_method` (`pix` ou `credit_card`) | Início da digitação dos dados de pagamento |
| `purchase` | `transaction_id`, `value`, `currency: 'BRL'`, `plan: 'pro'`, `cycle` | Confirmação de recebimento via webhook Asaas |

---

## 3. Diretrizes de Privacidade e Conformidade LGPD

> [!CAUTION]
> **Proibição Estrita de PII (Personally Identifiable Information)**:
> É expressamente proibido enviar dados pessoais ou financeiros sensíveis nos parâmetros dos eventos:
> - ❌ Nomes de pessoas ou empresas fornecedoras
> - ❌ E-mails ou números de telefone
> - ❌ Salários reais, rendas nominais ou valores individuais de despesas do usuário
> - ❌ Números de cartão de crédito, códigos CVV ou CPFs
> 
> ✅ Permitido: Categorias (ex: `'Alimentação'`), faixas de volume, contadores de itens, identificadores opacos gerados pelo sistema.

---

## 4. Google Consent Mode v2

Por padrão, a aplicação deve inicializar com consentimento em modo `denied` ou dinâmico:

```typescript
// Configuração inicial de consentimento
setConsent({
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
```

Ao aceitar as políticas de privacidade e cookies na barra de consentimento LGPD, execute:
```typescript
analyticsService.updateConsent(true);
```

---

## 5. Mocks para Testes Unitários (Vitest / Jasmine)

Para manter a suíte de testes 100% verde sem dependência de rede ou browser real:

```typescript
export const mockAnalyticsService = {
  trackPageView: vi.fn(),
  trackEvent: vi.fn(),
  setUser: vi.fn(),
  setUserProperties: vi.fn(),
  updateConsent: vi.fn()
};
```
