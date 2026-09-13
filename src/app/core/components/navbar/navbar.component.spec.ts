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
import { NavigationModalService } from '../../services/navigation-modal.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockThemeService: {
    currentTheme: WritableSignal<'dark' | 'light' | 'dark-blue'>;
    isDark: WritableSignal<boolean>;
    toggleTheme: ReturnType<typeof vi.fn>;
  };
  let mockPwaService: {
    isOnline: WritableSignal<boolean>;
    canInstall: WritableSignal<boolean>;
    installApp: ReturnType<typeof vi.fn>;
  };
  let mockNavModalService: {
    openCaixinha: ReturnType<typeof vi.fn>;
    openExport: ReturnType<typeof vi.fn>;
    openNewExpense: ReturnType<typeof vi.fn>;
    isCaixinhaOpen: WritableSignal<boolean>;
    isExportOpen: WritableSignal<boolean>;
    isNewExpenseOpen: WritableSignal<boolean>;
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
      isDuo: signal<boolean>(false),
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
      currentTheme: signal<'dark' | 'light' | 'dark-blue'>('dark'),
      isDark: signal<boolean>(true),
      toggleTheme: vi.fn()
    };

    mockPwaService = {
      isOnline: signal(true),
      canInstall: signal(false),
      installApp: vi.fn().mockResolvedValue(true)
    };

    mockNavModalService = {
      openCaixinha: vi.fn().mockResolvedValue(undefined),
      openExport: vi.fn().mockResolvedValue(undefined),
      openNewExpense: vi.fn().mockResolvedValue(undefined),
      isCaixinhaOpen: signal(false),
      isExportOpen: signal(false),
      isNewExpenseOpen: signal(false)
    };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: PwaService, useValue: mockPwaService },
        { provide: NavigationModalService, useValue: mockNavModalService }
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

  it('deve alternar o menu mobile drawer', () => {
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

  describe('Cenário BDD 1: Navegação no Desktop via Menus Semânticos', () => {
    it('deve renderizar os grupos semânticos essenciais no Desktop: Painel, Reservas, Compromissos e Relatórios', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('#nav-dashboard')).toBeTruthy();
      expect(el.querySelector('#nav-reservas')).toBeTruthy();
      expect(el.querySelector('#nav-parcelamentos')).toBeTruthy();
      expect(el.querySelector('#nav-relatorios')).toBeTruthy();
    });

    it('deve acionar openCaixinha do NavigationModalService ao clicar em Reservas', () => {
      const el = fixture.nativeElement as HTMLElement;
      const reservasBtn = el.querySelector('#nav-reservas') as HTMLButtonElement;
      reservasBtn.click();
      expect(mockNavModalService.openCaixinha).toHaveBeenCalled();
    });

    it('NÃO deve exibir menu do Casal para plano Free ou não-Duo', () => {
      (mockAuthStore.isDuo as WritableSignal<boolean>).set(false);
      fixture.detectChanges();
      const casalBtn = fixture.nativeElement.querySelector('#nav-casal');
      expect(casalBtn).toBeNull();
    });

    it('DEVE exibir menu do Casal quando usuário for do Plano Duo', () => {
      (mockAuthStore.isDuo as WritableSignal<boolean>).set(true);
      fixture.detectChanges();
      const casalBtn = fixture.nativeElement.querySelector('#nav-casal') as HTMLButtonElement;
      expect(casalBtn).toBeTruthy();
      expect(casalBtn.textContent).toContain('Casal');

      casalBtn.click();
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: { tab: 'nossos' } });
    });

    it('deve alternar dropdown de Relatórios e acionar exportação', () => {
      const el = fixture.nativeElement as HTMLElement;
      const relatoriosBtn = el.querySelector('#nav-relatorios') as HTMLButtonElement;

      expect(component.isReportsMenuOpen()).toBe(false);
      relatoriosBtn.click();
      fixture.detectChanges();

      expect(component.isReportsMenuOpen()).toBe(true);
      expect(el.querySelector('#dropdown-tributos')).toBeTruthy();
      expect(el.querySelector('#dropdown-viagens')).toBeTruthy();
      expect(el.querySelector('#dropdown-exportar')).toBeTruthy();

      const exportarBtn = el.querySelector('#dropdown-exportar') as HTMLButtonElement;
      exportarBtn.click();
      expect(mockNavModalService.openExport).toHaveBeenCalled();
    });
  });

  describe('Cenário BDD 2: Navegação Mobile via Bottom Navigation Bar', () => {
    it('deve renderizar a Bottom Navigation Bar com os 4 itens prioritários e o botão flutuante central', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.mobile-bottom-nav')).toBeTruthy();
      expect(el.querySelector('#bottom-nav-dashboard')).toBeTruthy();
      expect(el.querySelector('#bottom-nav-reservas')).toBeTruthy();
      expect(el.querySelector('#bottom-nav-action-new')).toBeTruthy();
      expect(el.querySelector('#bottom-nav-compromissos')).toBeTruthy();
      expect(el.querySelector('#bottom-nav-more')).toBeTruthy();
    });

    it('deve acionar openNewExpense do NavigationModalService ao clicar no botão flutuante central', () => {
      const el = fixture.nativeElement as HTMLElement;
      const actionNewBtn = el.querySelector('#bottom-nav-action-new') as HTMLButtonElement;
      actionNewBtn.click();
      expect(mockNavModalService.openNewExpense).toHaveBeenCalledWith(1);
    });

    it('deve acionar openCaixinha ao clicar no item de Reservas da barra inferior', () => {
      const el = fixture.nativeElement as HTMLElement;
      const reservasBtn = el.querySelector('#bottom-nav-reservas') as HTMLButtonElement;
      reservasBtn.click();
      expect(mockNavModalService.openCaixinha).toHaveBeenCalled();
    });

    it('deve abrir o drawer Mais ao clicar no botão correspondente da barra inferior', () => {
      const el = fixture.nativeElement as HTMLElement;
      const moreBtn = el.querySelector('#bottom-nav-more') as HTMLButtonElement;

      expect(component.isMobileMenuOpen()).toBe(false);
      moreBtn.click();
      fixture.detectChanges();

      expect(component.isMobileMenuOpen()).toBe(true);
      expect(el.querySelector('.mobile-menu-drawer')).toBeTruthy();
      expect(el.querySelector('#mobile-nav-tributos')).toBeTruthy();
      expect(el.querySelector('#mobile-nav-viagens')).toBeTruthy();
      expect(el.querySelector('#mobile-nav-exportar')).toBeTruthy();
      expect(el.querySelector('#mobile-nav-configuracoes')).toBeTruthy();
    });
  });

  describe('Cenário BDD 3: Segurança e Isolamento de Perfis (SEC)', () => {
    it('NÃO deve exibir link de Admin no perfil nem no drawer para usuários comuns', () => {
      (mockAuthStore.isAdmin as WritableSignal<boolean>).set(false);
      component.isProfileMenuOpen.set(true);
      component.isMobileMenuOpen.set(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('#nav-admin')).toBeNull();
      expect(el.querySelector('#mobile-nav-admin')).toBeNull();
    });

    it('DEVE exibir link de Admin no perfil e no drawer quando usuário for administrador', () => {
      (mockAuthStore.isAdmin as WritableSignal<boolean>).set(true);
      component.isProfileMenuOpen.set(true);
      component.isMobileMenuOpen.set(true);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('#nav-admin')).toBeTruthy();
      expect(el.querySelector('#mobile-nav-admin')).toBeTruthy();
    });
  });

  describe('Cenário BDD 4: Assinatura e Upgrades', () => {
    it('deve abrir e fechar o modal de assinatura', () => {
      expect(component.isSubscriptionModalOpen()).toBe(false);
      component.isSubscriptionModalOpen.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-subscription-modal')).toBeTruthy();

      component.isSubscriptionModalOpen.set(false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-subscription-modal')).toBeNull();
    });

    it('deve exibir botão Seja PRO para usuários Free', () => {
      (mockAuthStore.isProOrDuo as WritableSignal<boolean>).set(false);
      fixture.detectChanges();
      const proBtn = fixture.nativeElement.querySelector('.btn-upgrade-pro');
      expect(proBtn).toBeTruthy();
      expect(proBtn.textContent).toContain('Seja PRO');
    });
  });
});
