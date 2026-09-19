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

  it('deve inicializar com o tema deep-cobalt por padrão quando o usuário não escolhe', () => {
    expect(service.currentTheme()).toBe('deep-cobalt');
    expect(service.isDark()).toBe(true);
  });

  it('deve alternar o tema ciclando por todos os temas disponíveis via toggleTheme()', () => {
    // deep-cobalt (índice 0) -> electric-sky (índice 1)
    service.toggleTheme();
    expect(service.currentTheme()).toBe('electric-sky');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('electric-sky');

    // electric-sky -> obsidian
    service.toggleTheme();
    expect(service.currentTheme()).toBe('obsidian');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('obsidian');

    // obsidian -> dark-blue
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark-blue');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark-blue');

    // dark-blue -> dark
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('dark');

    // dark -> light
    service.toggleTheme();
    expect(service.currentTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem('app_theme_preference')).toBe('light');

    // light -> deep-cobalt
    service.toggleTheme();
    expect(service.currentTheme()).toBe('deep-cobalt');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('deep-cobalt');
  });

  it('deve definir tema explicitamente via setTheme()', () => {
    service.setTheme('electric-sky');
    expect(service.currentTheme()).toBe('electric-sky');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('electric-sky');

    service.setTheme('deep-cobalt');
    expect(service.currentTheme()).toBe('deep-cobalt');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('deep-cobalt');

    service.setTheme('obsidian');
    expect(service.currentTheme()).toBe('obsidian');
    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('app_theme_preference')).toBe('obsidian');

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
