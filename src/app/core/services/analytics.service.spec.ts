import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { AnalyticsService, ANALYTICS_ADAPTER, AnalyticsAdapter } from './analytics.service';
import { FirebaseService } from './firebase.service';
import { environment } from '../../../environments/environment';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let routerEvents$: Subject<any>;
  let mockRouter: any;
  let mockFirebaseService: any;
  let mockAdapter: AnalyticsAdapter;

  beforeEach(() => {
    routerEvents$ = new Subject<any>();
    mockRouter = {
      events: routerEvents$.asObservable()
    };
    mockFirebaseService = {
      app: { name: '[DEFAULT]' }
    };

    mockAdapter = {
      isSupported: vi.fn().mockResolvedValue(true),
      getAnalytics: vi.fn().mockReturnValue({ app: '[DEFAULT]' } as any),
      logEvent: vi.fn(),
      setConsent: vi.fn(),
      setUserId: vi.fn(),
      setUserProperties: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: Router, useValue: mockRouter },
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: ANALYTICS_ADAPTER, useValue: mockAdapter }
      ]
    });

    service = TestBed.inject(AnalyticsService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });

  describe('Cenário BDD 1: Inicialização Segura e Condicional', () => {
    it('deve inicializar analytics quando isSupported retornar true', async () => {
      (mockAdapter.isSupported as any).mockResolvedValue(true);

      const result = await service.init();

      expect(result).toBe(true);
      expect(mockAdapter.getAnalytics).toHaveBeenCalledWith(mockFirebaseService.app);
      expect(service.isReady()).toBe(true);
    });

    it('não deve quebrar quando isSupported retornar false', async () => {
      (mockAdapter.isSupported as any).mockResolvedValue(false);

      const result = await service.init();

      expect(result).toBe(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('Cenário BDD 2: Rastreamento de Rotas e Page Views', () => {
    it('deve emitir page_view em produção quando a rota mudar', async () => {
      const originalProduction = environment.production;
      (environment as any).production = true;

      await service.init();

      routerEvents$.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

      expect(mockAdapter.logEvent).toHaveBeenCalledWith(expect.anything(), 'page_view', {
        page_path: '/dashboard',
        page_title: ''
      });

      (environment as any).production = originalProduction;
    });

    it('não deve emitir page_view quando environment.production for false', async () => {
      const originalProduction = environment.production;
      (environment as any).production = false;

      await service.init();

      service.trackPageView('/dashboard');

      expect(mockAdapter.logEvent).not.toHaveBeenCalled();

      (environment as any).production = originalProduction;
    });
  });

  describe('Cenário BDD 3: Consent Mode v2 (LGPD)', () => {
    it('deve chamar setConsent com granted ao autorizar consentimento', () => {
      service.updateConsent(true);

      expect(mockAdapter.setConsent).toHaveBeenCalledWith({
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    });

    it('deve chamar setConsent com denied ao recusar consentimento', () => {
      service.updateConsent(false);

      expect(mockAdapter.setConsent).toHaveBeenCalledWith({
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    });
  });

  describe('Cenário BDD 4: Eventos e Sanitização de PII', () => {
    it('deve sanitizar parâmetros removendo chaves com dados sensíveis (PII)', async () => {
      const originalProduction = environment.production;
      (environment as any).production = true;

      await service.init();

      service.trackEvent('create_expense', {
        tipo: 'fixa',
        quinzena: 1,
        categoria: 'Alimentação',
        user_email: 'teste@privado.com',
        user_cpf: '123.456.789-00',
        cartao_numero: '411111111111'
      } as any);

      expect(mockAdapter.logEvent).toHaveBeenCalledWith(expect.anything(), 'create_expense', {
        tipo: 'fixa',
        quinzena: 1,
        categoria: 'Alimentação'
      });

      (environment as any).production = originalProduction;
    });

    it('deve delegar setUserId e setUserProperties para as funções do SDK', async () => {
      await service.init();

      service.setUserId('user-anonymous-123');
      service.setUserProperties({ theme: 'dark', plan: 'pro' });

      expect(mockAdapter.setUserId).toHaveBeenCalledWith(expect.anything(), 'user-anonymous-123');
      expect(mockAdapter.setUserProperties).toHaveBeenCalledWith(expect.anything(), { theme: 'dark', plan: 'pro' });
    });
  });
});
