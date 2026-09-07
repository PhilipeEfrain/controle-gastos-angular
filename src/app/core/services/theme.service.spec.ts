import { TestBed } from '@angular/core/testing';
import { ThemeService, AppTheme } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('deve inicializar com o tema dark por padrão', () => {
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('deve alternar o tema entre dark e light via toggleTheme()', () => {
    service.toggleTheme();
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem('app_theme_preference')).toBe('light');

    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');
  });

  it('deve definir tema explicitamente via setTheme()', () => {
    service.setTheme('light');
    expect(service.currentTheme()).toBe('light');
    expect(localStorage.getItem('app_theme_preference')).toBe('light');

    service.setTheme('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');
  });
});
