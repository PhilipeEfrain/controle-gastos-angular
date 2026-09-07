import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatBRL } from '../../../core/utils/formatters';

export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-balance-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './balance-badge.component.html',
  styleUrl: './balance-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BalanceBadgeComponent {
  readonly value = input.required<number>();
  readonly label = input<string>();
  readonly size = input<BadgeSize>('md');
  readonly showSign = input<boolean>(true);

  readonly isPositive = computed(() => (this.value() ?? 0) >= 0);
  readonly formattedValue = computed(() => formatBRL(this.value()));
}
