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
  readonly hasExtraIncome = input<boolean>(false);
  readonly extraIncomeAmount = input<number>(0);
  readonly tooltipText = input<string>('Saldo com acréscimo de renda extra');

  readonly isPositive = computed(() => (this.value() ?? 0) >= 0);
  readonly formattedValue = computed(() => formatBRL(this.value()));
  readonly resolvedTooltip = computed(() => {
    const base = this.tooltipText();
    const amount = this.extraIncomeAmount();
    if (amount > 0) {
      return `${base} (+ ${formatBRL(amount)})`;
    }
    return base;
  });
}
