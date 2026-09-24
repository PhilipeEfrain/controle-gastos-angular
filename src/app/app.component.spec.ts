import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app.component';
import { AuthStore } from './core/state/auth.store';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { PwaService } from './core/services/pwa.service';
import { AnalyticsService } from './core/services/analytics.service';
import { NavigationModalService } from './core/services/navigation-modal.service';
import { signal, WritableSignal } from '@angular/core';

describe('App', () => {
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockPwaService: {
    isOnline: WritableSignal<boolean>;
    canInstall: WritableSignal<boolean>;
    updateAvailable: WritableSignal<boolean>;
    activateUpdate: ReturnType<typeof vi.fn>;
    installApp: ReturnType<typeof vi.fn>;
  };
  let mockAnalyticsService: Partial<AnalyticsService>;
  let isAuthenticatedSignal: WritableSignal<boolean>;
  let router: Router;

  beforeEach(async () => {
    isAuthenticatedSignal = signal(false);

    mockAnalyticsService = {
      init: vi.fn().mockResolvedValue(true),
      trackPageView: vi.fn(),
      trackEvent: vi.fn(),
      setUserId: vi.fn(),
      setUserProperties: vi.fn(),
      updateConsent: vi.fn(),
      isReady: vi.fn().mockReturnValue(true)
    };

    mockAuthStore = {
      currentUser: signal(null),
      isAuthenticated: isAuthenticatedSignal,
      isProOrDuo: signal(false),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthService = {
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockNotificationService = {
      notifications: signal([]),
      dismiss: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    };

    mockPwaService = {
      isOnline: signal(true),
      canInstall: signal(false),
      updateAvailable: signal(false),
      activateUpdate: vi.fn(),
      installApp: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'auth', children: [] },
          { path: 'dashboard', children: [] },
          { path: 'termos', children: [] },
          { path: 'privacidade', children: [] },
          { path: 'dividir', children: [] },
          { path: 'dividir/:id', children: [] }
        ]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PwaService, useValue: mockPwaService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: NavigationModalService, useValue: {
          openFeedback: vi.fn(),
          closeFeedback: vi.fn(),
          isFeedbackOpen: signal(false),
          feedbackContext: signal(null),
          activeModal: signal(null)
        }}
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('deve criar a casca principal da aplicação (App Shell)', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('não deve exibir a Navbar quando o usuário não estiver autenticado', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.showNavbar()).toBe(false);
  });

  it('não deve exibir a Navbar quando estiver na rota /auth mesmo se autenticado', async () => {
    isAuthenticatedSignal.set(true);
    await router.navigate(['/auth']);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showNavbar()).toBe(false);
  });

  it('deve exibir a Navbar quando autenticado e navegando para /dashboard', async () => {
    isAuthenticatedSignal.set(true);
    await router.navigate(['/dashboard']);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showNavbar()).toBe(true);
  });

  it('não deve exibir a Navbar na landing page pública / mesmo se autenticado', async () => {
    isAuthenticatedSignal.set(true);
    await router.navigate(['/']);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showNavbar()).toBe(false);
  });

  it('não deve exibir a Navbar na landing page com âncora /#recursos mesmo se autenticado', async () => {
    isAuthenticatedSignal.set(true);
    await router.navigate(['/'], { fragment: 'recursos' });

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showNavbar()).toBe(false);
  });

  it('não deve exibir a Navbar nas páginas legais (/termos, /privacidade)', async () => {
    isAuthenticatedSignal.set(true);
    await router.navigate(['/termos']);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.showNavbar()).toBe(false);

    await router.navigate(['/privacidade']);
    expect(app.showNavbar()).toBe(false);
  });

  describe('Anúncios Laterais (AdSidebar)', () => {
    it('deve exibir anúncios laterais na rota /dividir mesmo para usuário não autenticado', async () => {
      isAuthenticatedSignal.set(false);
      await router.navigate(['/dividir']);

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app.isDividirPage()).toBe(true);
      expect(app.showAdSidebar()).toBe(true);
    });

    it('deve exibir anúncios laterais na rota /dividir/:id mesmo para assinantes PRO', async () => {
      isAuthenticatedSignal.set(true);
      (mockAuthStore.isProOrDuo as WritableSignal<boolean>).set(true);
      await router.navigate(['/dividir/grupo-123']);

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app.isDividirPage()).toBe(true);
      expect(app.showAdSidebar()).toBe(true);
    });

    it('deve exibir anúncios laterais no /dashboard para usuários Free autenticados', async () => {
      isAuthenticatedSignal.set(true);
      (mockAuthStore.isProOrDuo as WritableSignal<boolean>).set(false);
      await router.navigate(['/dashboard']);

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app.isDividirPage()).toBe(false);
      expect(app.showAdSidebar()).toBe(true);
    });

    it('NÃO deve exibir anúncios laterais no /dashboard para assinantes PRO', async () => {
      isAuthenticatedSignal.set(true);
      (mockAuthStore.isProOrDuo as WritableSignal<boolean>).set(true);
      await router.navigate(['/dashboard']);

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app.isDividirPage()).toBe(false);
      expect(app.showAdSidebar()).toBe(false);
    });

    it('NÃO deve exibir anúncios laterais na landing page / ou na autenticação /auth', async () => {
      isAuthenticatedSignal.set(false);
      await router.navigate(['/']);

      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      expect(app.showAdSidebar()).toBe(false);

      await router.navigate(['/auth']);
      expect(app.showAdSidebar()).toBe(false);
    });
  });
});
