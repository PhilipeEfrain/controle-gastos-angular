import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';
import { formatBRL } from '../../../../core/utils/formatters';
import { roundBRL } from '../../../../core/utils/calculations';

@Component({
  selector: 'app-tax-comparison-card',
  standalone: true,
  imports: [CommonModule, AppCardComponent, ProgressBarComponent],
  templateUrl: './tax-comparison-card.component.html',
  styleUrls: ['./tax-comparison-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxComparisonCardComponent {
  readonly totalBudget = input.required<number>();
  readonly totalPaid = input.required<number>();
  readonly taxesCount = input<number>(0);
  readonly paidCount = input<number>(0);

  readonly formattedTotalBudget = computed(() => formatBRL(this.totalBudget()));
  readonly formattedTotalPaid = computed(() => formatBRL(this.totalPaid()));

  readonly difference = computed(() => {
    return roundBRL(this.totalBudget() - this.totalPaid());
  });

  readonly formattedDifference = computed(() => formatBRL(Math.abs(this.difference())));

  readonly progressPercentage = computed(() => {
    const budget = this.totalBudget();
    if (budget <= 0) return 0;
    const ratio = (this.totalPaid() / budget) * 100;
    return Math.min(Math.round(ratio), 100);
  });
}
