import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PwaService } from '../../services/pwa.service';
import { UserProfile } from '../../models/user.model';
import { signal, WritableSignal } from '@angular/core';

import { ThemeService } from '../../services/theme.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockThemeService: {
    currentTheme: WritableSignal<'dark' | 'light'>;
    isDark: WritableSignal<boolean>;
    toggleTheme: ReturnType<typeof vi.fn>;
  };
  let mockPwaService: {
    isOnline: WritableSignal<boolean>;
    canInstall: WritableSignal<boolean>;
    installApp: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const mockUser: UserProfile = {
    uid: 'user-123',
    email: 'philipe@example.com',
    displayName: 'Philipe Efrain',
    photoURL: null,
    preferences: { theme: 'dark', currency: 'BRL' },
    createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      isAuthenticated: signal<boolean>(true),
      isAdmin: signal<boolean>(false),
      isProOrDuo: signal<boolean>(false),
      currentPlan: signal<'free' | 'pro' | 'duo'>('free'),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockAuthService = {
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockNotificationService = {
      info: vi.fn(),
      error: vi.fn(),
      success: vi.fn()
    };

    mockThemeService = {
      currentTheme: signal<'dark' | 'light'>('dark'),
      isDark: signal<boolean>(true),
      toggleTheme: vi.fn()
    };

    mockPwaService = {
      isOnline: signal(true),
      canInstall: signal(false),
      installApp: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: PwaService, useValue: mockPwaService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('deve criar o componente Navbar', () => {
    expect(component).toBeTruthy();
  });

  it('deve computar as iniciais do usuário corretamente', () => {
    expect(component.userInitials()).toBe('PE');
  });

  it('deve alternar o menu mobile', () => {
    expect(component.isMobileMenuOpen()).toBe(false);
    component.toggleMobileMenu();
    expect(component.isMobileMenuOpen()).toBe(true);
    component.closeMobileMenu();
    expect(component.isMobileMenuOpen()).toBe(false);
  });

  it('deve realizar logout, limpar AuthStore e redirecionar para /auth', async () => {
    await component.logout();

    expect(mockAuthStore.logout).toHaveBeenCalled();
    expect(mockNotificationService.info).toHaveBeenCalledWith('Você saiu da sua conta.');
    expect(router.navigate).toHaveBeenCalledWith(['/auth']);
  });

  it('deve exibir badge de offline quando desconectado', () => {
    mockPwaService.isOnline.set(false);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.offline-status-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Offline');
  });

  it('deve exibir botão de instalar app quando canInstall for true e disparar installPwa', async () => {
    mockPwaService.canInstall.set(true);
    fixture.detectChanges();
    const installBtn = fixture.nativeElement.querySelector('.btn-install-pwa');
    expect(installBtn).toBeTruthy();

    await component.installPwa();
    expect(mockPwaService.installApp).toHaveBeenCalled();
  });

  it('deve chamar toggleTheme ao clicar no botão de tema', () => {
    component.toggleTheme();
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('Cenário BDD (RBAC UX): NÃO deve exibir link de Admin para usuários comuns', () => {
    (mockAuthStore.isAdmin as WritableSignal<boolean>).set(false);
    fixture.detectChanges();
    const adminLink = fixture.nativeElement.querySelector('#nav-admin');
    expect(adminLink).toBeNull();
  });

  it('Cenário BDD (RBAC UX): DEVE exibir link de Admin quando usuário for administrador', () => {
    (mockAuthStore.isAdmin as WritableSignal<boolean>).set(true);
    fixture.detectChanges();
    const adminLink = fixture.nativeElement.querySelector('#nav-admin');
    expect(adminLink).toBeTruthy();
    expect(adminLink.textContent).toContain('Admin');
  });

  it('Cenário BDD (Assinatura): DEVE abrir e fechar o modal de assinatura', () => {
    expect(component.isSubscriptionModalOpen()).toBe(false);
    component.isSubscriptionModalOpen.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-subscription-modal')).toBeTruthy();

    component.isSubscriptionModalOpen.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-subscription-modal')).toBeNull();
  });

  it('Cenário BDD (Assinatura): DEVE exibir botão Seja PRO para usuários Free', () => {
    (mockAuthStore.isProOrDuo as WritableSignal<boolean>).set(false);
    fixture.detectChanges();
    const proBtn = fixture.nativeElement.querySelector('.btn-upgrade-pro');
    expect(proBtn).toBeTruthy();
    expect(proBtn.textContent).toContain('Seja PRO');
  });

  it('Cenário BDD 1 (Responsividade Mobile): DEVE alternar exibição do drawer mobile ao interagir com o botão hambúrguer', () => {
    expect(component.isMobileMenuOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.mobile-menu')).toBeNull();

    component.toggleMobileMenu();
    fixture.detectChanges();

    expect(component.isMobileMenuOpen()).toBe(true);
    const mobileMenu = fixture.nativeElement.querySelector('.mobile-menu');
    expect(mobileMenu).toBeTruthy();
    expect(mobileMenu.querySelectorAll('.mobile-nav-link').length).toBeGreaterThan(0);

    component.closeMobileMenu();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mobile-menu')).toBeNull();
  });
});
