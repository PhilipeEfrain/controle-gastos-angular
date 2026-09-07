import { Injectable, signal, computed, effect } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app_theme_preference';

  // Signal com o tema ativo
  readonly currentTheme = signal<AppTheme>('dark');
  readonly isDark = computed(() => this.currentTheme() === 'dark');

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
      if (savedTheme === 'light' || savedTheme === 'dark') {
        this.currentTheme.set(savedTheme);
        return;
      }
    }
    // Default Dark
    this.currentTheme.set('dark');
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  private applyThemeToDOM(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
