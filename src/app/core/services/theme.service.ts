import { Injectable, signal, computed, effect } from '@angular/core';

export type AppTheme = 'dark' | 'electric-sky' | 'dark-blue' | 'deep-cobalt' | 'obsidian' | 'light';

export const AVAILABLE_THEMES: AppTheme[] = [
  'deep-cobalt',
  'electric-sky',
  'obsidian',
  'dark-blue',
  'dark',
  'light'
];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app_theme_preference';

  // Signal com o tema ativo (Padrão: Deep Cobalt)
  readonly currentTheme = signal<AppTheme>('deep-cobalt');
  readonly isDark = computed(() => this.currentTheme() !== 'light');

  constructor() {
    this.initTheme();

    // Efeito para sincronizar atributo no DOM sempre que o signal mudar
    effect(() => {
      const theme = this.currentTheme();
      this.applyThemeToDOM(theme);
    });
  }

  private initTheme(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
      if (savedTheme && AVAILABLE_THEMES.includes(savedTheme)) {
        this.currentTheme.set(savedTheme);
        return;
      }
    }
    // Default: Deep Cobalt quando o usuário não escolhe
    this.currentTheme.set('deep-cobalt');
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
  }

  toggleTheme(): void {
    const current = this.currentTheme();
    const currentIndex = AVAILABLE_THEMES.indexOf(current);
    const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length;
    this.setTheme(AVAILABLE_THEMES[nextIndex]);
  }

  private applyThemeToDOM(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
