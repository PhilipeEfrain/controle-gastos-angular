import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app.component';
import { AuthStore } from './core/state/auth.store';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { PwaService } from './core/services/pwa.service';
import { AnalyticsService } from './core/services/analytics.service';
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
          { path: 'auth', children: [] },
          { path: 'dashboard', children: [] }
        ]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PwaService, useValue: mockPwaService },
        { provide: AnalyticsService, useValue: mockAnalyticsService }
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
});
