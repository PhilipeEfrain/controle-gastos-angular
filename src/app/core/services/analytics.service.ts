import { Injectable, InjectionToken, inject, NgZone } from '@angular/core';
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

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsAdapter {
  isSupported(): Promise<boolean>;
  getAnalytics(app: any): Analytics;
  logEvent(analytics: Analytics, eventName: string, eventParams?: any): void;
  setConsent(consentSettings: any): void;
  setUserId(analytics: Analytics, id: string | null): void;
  setUserProperties(analytics: Analytics, properties: any): void;
}

export const ANALYTICS_ADAPTER = new InjectionToken<AnalyticsAdapter>('ANALYTICS_ADAPTER', {
  providedIn: 'root',
  factory: () => ({
    isSupported,
    getAnalytics,
    logEvent,
    setConsent,
    setUserId,
    setUserProperties
  })
});

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly adapter: AnalyticsAdapter = inject<AnalyticsAdapter>(ANALYTICS_ADAPTER);

  private analyticsInstance: Analytics | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  /**
   * Inicialização assíncrona e condicional baseada na disponibilidade do navegador
   */
  async init(): Promise<boolean> {
    try {
      const supported = await this.adapter.isSupported();
      if (supported && this.firebaseService.app) {
        this.analyticsInstance = this.adapter.getAnalytics(this.firebaseService.app);
        this.isInitialized = true;
        this.setupRouteTracking();
        return true;
      }
    } catch {
      // Falha silenciosa em ambientes sem suporte (testes, SSR, bloqueadores)
    }

    this.analyticsInstance = null;
    this.isInitialized = false;
    return false;
  }

  /**
   * Retorna true se a instância do Analytics está ativa e suportada
   */
  isReady(): boolean {
    return this.isInitialized && this.analyticsInstance !== null;
  }

  /**
   * Escuta transições de rotas para registrar page views automaticamente
   */
  private setupRouteTracking(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.trackPageView(event.urlAfterRedirects);
      });
  }

  /**
   * Rastreia visualização de tela / rota
   */
  trackPageView(pagePath: string, pageTitle?: string): void {
    const pageData = {
      page_path: pagePath,
      page_title: pageTitle || (typeof document !== 'undefined' ? document.title : '')
    };

    this.pushToDataLayer({
      event: 'page_view',
      ...pageData
    });

    if (!this.analyticsInstance || !environment.production) return;

    this.ngZone.runOutsideAngular(() => {
      try {
        this.adapter.logEvent(this.analyticsInstance!, 'page_view', pageData);
      } catch {
        // Silêncio defensivo
      }
    });
  }

  /**
   * Rastreia eventos de interação com dados sanitizados
   */
  trackEvent(eventName: string, params?: AnalyticsEventParams): void {
    const sanitizedParams = this.sanitizeParams(params);

    this.pushToDataLayer({
      event: eventName,
      ...sanitizedParams
    });

    if (!this.analyticsInstance || !environment.production) return;

    this.ngZone.runOutsideAngular(() => {
      try {
        this.adapter.logEvent(this.analyticsInstance!, eventName, sanitizedParams);
      } catch {
        // Silêncio defensivo
      }
    });
  }

  /**
   * Associa o identificador anônimo do usuário
   */
  setUserId(userId: string | null): void {
    this.pushToDataLayer({
      user_id: userId
    });

    if (!this.analyticsInstance) return;

    try {
      this.adapter.setUserId(this.analyticsInstance, userId);
    } catch {
      // Silêncio defensivo
    }
  }

  /**
   * Define propriedades personalizadas do usuário (ex: plano, tema)
   */
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    this.pushToDataLayer({
      user_properties: properties
    });

    if (!this.analyticsInstance) return;

    try {
      this.adapter.setUserProperties(this.analyticsInstance, properties);
    } catch {
      // Silêncio defensivo
    }
  }

  /**
   * Atualiza as permissões do Google Consent Mode v2 (LGPD / Privacidade)
   */
  updateConsent(granted: boolean): void {
    const status = granted ? 'granted' : 'denied';

    this.pushToDataLayer({
      event: 'consent_update',
      consent_status: status
    });

    try {
      this.adapter.setConsent({
        analytics_storage: status,
        ad_storage: status,
        ad_user_data: status,
        ad_personalization: status
      });
    } catch {
      // Silêncio defensivo
    }
  }

  /**
   * Envia eventos e estados para o dataLayer do Google Tag Manager
   */
  private pushToDataLayer(payload: Record<string, any>): void {
    if (typeof window !== 'undefined') {
      const win = window as any;
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push(payload);
    }
  }

  /**
   * Remove chaves sensíveis que possam acidentalmente conter PII
   */
  private sanitizeParams(params?: AnalyticsEventParams): Record<string, string | number | boolean> {
    if (!params) return {};

    const sanitized: Record<string, string | number | boolean> = {};
    const blockedKeys = ['email', 'cpf', 'senha', 'password', 'token', 'phone', 'telefone', 'cartao', 'card'];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;

      const lowerKey = key.toLowerCase();
      const isBlocked = blockedKeys.some(blocked => lowerKey.includes(blocked));

      if (!isBlocked) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
