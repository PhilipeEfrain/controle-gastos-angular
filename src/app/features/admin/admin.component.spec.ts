import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminComponent } from './admin.component';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { PwaService } from '../../core/services/pwa.service';
import { signal } from '@angular/core';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    const mockAuthStore = {
      currentUser: signal({
        uid: 'admin-123',
        email: 'admin@quinzena.app',
        displayName: 'Administrador',
        photoURL: null,
        role: 'admin',
        plan: 'pro'
      }),
      isAuthenticated: signal(true),
      isAdmin: signal(true),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    const mockAuthService = {
      logout: vi.fn().mockResolvedValue(undefined)
    };

    const mockNotificationService = {
      info: vi.fn(),
      error: vi.fn(),
      success: vi.fn()
    };

    const mockThemeService = {
      currentTheme: signal('dark'),
      isDark: signal(true),
      toggleTheme: vi.fn()
    };

    const mockPwaService = {
      isOnline: signal(true),
      canInstall: signal(false),
      installApp: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: PwaService, useValue: mockPwaService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente Admin', () => {
    expect(component).toBeTruthy();
  });

  it('deve exibir o título do Painel Administrativo', () => {
    const title = fixture.nativeElement.querySelector('h1');
    expect(title.textContent).toContain('Painel Administrativo');
  });
});
