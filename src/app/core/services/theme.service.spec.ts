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

  it('deve alternar o tema ciclando entre dark, dark-blue e light via toggleTheme()', () => {
    // dark -> dark-blue
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark-blue');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark-blue');

    // dark-blue -> light
    service.toggleTheme();
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem('app_theme_preference')).toBe('light');

    // light -> dark
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');
  });

  it('deve definir tema explicitamente via setTheme()', () => {
    service.setTheme('dark-blue');
    expect(service.currentTheme()).toBe('dark-blue');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark-blue');

    service.setTheme('light');
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem('app_theme_preference')).toBe('light');

    service.setTheme('dark');
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');
  });
});
