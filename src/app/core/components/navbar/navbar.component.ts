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

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private authStore = inject(AuthStore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isLoggingOut = signal<boolean>(false);

  readonly user = this.authStore.currentUser;
  readonly isAuthenticated = this.authStore.isAuthenticated;

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
