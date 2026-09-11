import { Component, ChangeDetectionStrategy, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../core/state/auth.store';

@Component({
  selector: 'app-ad-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-banner.component.html',
  styleUrl: './ad-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdBannerComponent {
  private readonly authStore = inject(AuthStore);

  readonly slotId = input<string>('top-dashboard');
  readonly adClient = input<string>('ca-pub-0000000000000000');
  readonly showUpgradePrompt = input<boolean>(true);

  readonly upgradeClick = output<void>();

  // Apenas renderiza para usuários sem plano PRO ou DUO ativo
  readonly isFreeUser = computed(() => !this.authStore.isProOrDuo());

  onUpgrade(): void {
    this.upgradeClick.emit();
  }
}
