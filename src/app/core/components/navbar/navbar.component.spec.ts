import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PwaService } from '../../services/pwa.service';
import { UserProfile } from '../../models/user.model';
import { signal, WritableSignal } from '@angular/core';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;
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
});
