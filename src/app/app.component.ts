import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { AuthStore } from './core/state/auth.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private authStore = inject(AuthStore);
  private router = inject(Router);

  protected readonly title = signal('controle-gastos-angular');
  private readonly currentUrl = signal<string>(this.router.url || '');

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(event => {
      this.currentUrl.set(event.urlAfterRedirects || event.url);
    });
  }

  readonly showNavbar = computed(() => {
    const url = this.currentUrl() || this.router.url || '';
    const isAuthPage = url.startsWith('/auth') || url.includes('/auth');
    return this.authStore.isAuthenticated() && !isAuthPage;
  });
}
