import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-logo.component.html',
  styleUrls: ['./brand-logo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandLogoComponent {
  private readonly themeService = inject(ThemeService);

  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly showText = input<boolean>(true);
  readonly showTagline = input<boolean>(false);
  readonly forceTheme = input<'dark' | 'dark-blue' | 'light' | null>(null);

  get isDark(): boolean {
    const forced = this.forceTheme();
    if (forced) {
      return forced === 'dark' || forced === 'dark-blue';
    }
    return this.themeService.isDark();
  }
}
