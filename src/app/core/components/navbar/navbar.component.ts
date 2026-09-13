import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  HostListener,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PwaService } from '../../services/pwa.service';
import { ThemeService } from '../../services/theme.service';
import { NavigationModalService } from '../../services/navigation-modal.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { SubscriptionModalComponent } from '../../../shared/components/subscription-modal/subscription-modal.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, BrandLogoComponent, SubscriptionModalComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private readonly elementRef = inject(ElementRef);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly pwaService = inject(PwaService);
  readonly themeService = inject(ThemeService);
  readonly navModalService = inject(NavigationModalService);

  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isReportsMenuOpen = signal<boolean>(false);
  readonly isProfileMenuOpen = signal<boolean>(false);
  readonly isLoggingOut = signal<boolean>(false);
  readonly isSubscriptionModalOpen = signal<boolean>(false);

  readonly user = this.authStore.currentUser;
  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly isAdmin = this.authStore.isAdmin;
  readonly isProOrDuo = this.authStore.isProOrDuo;
  readonly currentPlan = this.authStore.currentPlan;
  readonly isDuo = this.authStore.isDuo;
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeReportsMenu();
      this.closeProfileMenu();
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async installPwa(): Promise<void> {
    await this.pwaService.installApp();
  }

  toggleReportsMenu(): void {
    this.isReportsMenuOpen.update(prev => !prev);
    this.isProfileMenuOpen.set(false);
  }

  closeReportsMenu(): void {
    this.isReportsMenuOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update(prev => !prev);
    this.isReportsMenuOpen.set(false);
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(prev => !prev);
    this.closeReportsMenu();
    this.closeProfileMenu();
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  closeAllMenus(): void {
    this.isReportsMenuOpen.set(false);
    this.isProfileMenuOpen.set(false);
    this.isMobileMenuOpen.set(false);
  }

  openCaixinha(): void {
    this.closeAllMenus();
    this.navModalService.openCaixinha();
  }

  openExport(): void {
    this.closeAllMenus();
    this.navModalService.openExport();
  }

  openNewExpense(quinzena: 1 | 2 = 1): void {
    this.closeAllMenus();
    this.navModalService.openNewExpense(quinzena);
  }

  navigateToDuo(): void {
    this.closeAllMenus();
    this.router.navigate(['/dashboard'], { queryParams: { tab: 'nossos' } });
  }

  onOpenDuoPairingFromNavbar(): void {
    this.isSubscriptionModalOpen.set(false);
    this.router.navigate(['/dashboard']);
  }

  async logout(): Promise<void> {
    this.isLoggingOut.set(true);
    try {
      await this.authStore.logout();
      this.notificationService.info('Você saiu da sua conta.');
      this.closeAllMenus();
      this.router.navigate(['/auth']);
    } catch (err: any) {
      this.notificationService.error(err?.message || 'Erro ao realizar logout.');
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
