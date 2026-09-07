import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app.component';
import { AuthStore } from './core/state/auth.store';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { signal } from '@angular/core';

describe('App', () => {
  let mockAuthStore: Partial<AuthStore>;
  let mockAuthService: Partial<AuthService>;
  let mockNotificationService: Partial<NotificationService>;

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal(null),
      isAuthenticated: signal(false),
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

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();
  });

  it('deve criar a casca principal da aplicação (App Shell)', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
