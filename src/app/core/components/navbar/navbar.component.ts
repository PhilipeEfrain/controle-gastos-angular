import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PwaService } from '../../services/pwa.service';
import { ThemeService } from '../../services/theme.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, BrandLogoComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private pwaService = inject(PwaService);
  readonly themeService = inject(ThemeService);

  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isLoggingOut = signal<boolean>(false);

  readonly user = this.authStore.currentUser;
  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly isOnline = this.pwaService.isOnline;
  readonly canInstall = this.pwaService.canInstall;
  readonly isDark = this.themeService.isDark;
  readonly currentTheme = this.themeService.currentTheme;

  readonly themeTooltip = computed(() => {
    const theme = this.currentTheme();
    if (theme === 'dark') return 'Tema atual: Escuro Quinzena (clique para Escuro Azul)';
    if (theme === 'dark-blue') return 'Tema atual: Escuro Azul (clique para Modo Claro)';
    return 'Tema atual: Modo Claro (clique para Escuro Quinzena)';
  });

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async installPwa(): Promise<void> {
    await this.pwaService.installApp();
  }

  readonly userInitials = computed(() => {
    const user = this.user();
    if (!user) return 'U';
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  });

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(prev => !prev);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.isLoggingOut.set(true);
    try {
      await this.authStore.logout();
      this.notificationService.info('Você saiu da sua conta.');
      this.closeMobileMenu();
      this.router.navigate(['/auth']);
    } catch (err: any) {
      this.notificationService.error(err?.message || 'Erro ao realizar logout.');
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
