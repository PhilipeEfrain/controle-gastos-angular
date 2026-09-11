import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { OfflineBannerComponent } from './shared/components/offline-banner/offline-banner.component';
import { AuthStore } from './core/state/auth.store';
import { AnalyticsService } from './core/services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, ToastContainerComponent, OfflineBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  protected readonly title = signal('controle-gastos-angular');
  private readonly currentUrl = signal<string>(this.router.url || '');

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => {
      this.currentUrl.set(event.urlAfterRedirects || event.url);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.currentUrl.set(window.location.pathname + window.location.search + window.location.hash);
      });
    }
  }

  readonly showNavbar = computed(() => {
    const rawUrl = this.currentUrl() || this.router.url || (typeof window !== 'undefined' ? window.location.pathname + window.location.hash : '');
    const cleanUrl = rawUrl.split('?')[0].split('#')[0];
    const isAuthPage = cleanUrl.startsWith('/auth');
    const isLandingPage = cleanUrl === '/' || cleanUrl === '';
    const isLegalPage = cleanUrl === '/termos' || cleanUrl === '/privacidade';
    return this.authStore.isAuthenticated() && !isAuthPage && !isLandingPage && !isLegalPage;
  });
}
