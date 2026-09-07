import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { UserProfile } from '../../models/user.model';
import { signal } from '@angular/core';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;
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

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService }
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
});
