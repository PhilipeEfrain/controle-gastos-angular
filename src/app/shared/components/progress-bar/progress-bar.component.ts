import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatPercent } from '../../../core/utils/formatters';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressBarComponent {
  readonly current = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input<string>();
  readonly showLabel = input<boolean>(true);
  readonly height = input<string>('8px');

  // Percentual entre 0 e 100
  readonly percentage = computed(() => {
    const maxVal = this.max();
    if (!maxVal || maxVal <= 0) {
      return 0;
    }
    const ratio = (this.current() / maxVal) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  });

  readonly formattedPercentage = computed(() => formatPercent(this.percentage()));

  // Status visual baseado no comprometimento da renda
  readonly status = computed(() => {
    const pct = this.percentage();
    if (pct >= 90) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
  });
}
