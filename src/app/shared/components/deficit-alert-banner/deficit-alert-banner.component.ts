import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatBRL } from '../../../core/utils/formatters';

@Component({
  selector: 'app-deficit-alert-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deficit-alert-banner.component.html',
  styleUrl: './deficit-alert-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeficitAlertBannerComponent {
  readonly temDeficitGlobal = input<boolean>(false);
  readonly q1CobreQ2 = input<boolean>(true);
  readonly saldoQ1 = input<number>(0);
  readonly saldoQ2 = input<number>(0);
  readonly saldoFinal = input<number>(0);

  // Determina se algum alerta precisa ser renderizado
  readonly shouldShowAlert = computed(() => {
    return this.temDeficitGlobal() || (this.saldoQ2() < 0 && this.q1CobreQ2());
  });

  readonly isCritical = computed(() => this.temDeficitGlobal());

  readonly formattedSaldoQ1 = computed(() => formatBRL(this.saldoQ1()));
  readonly formattedSaldoQ2 = computed(() => formatBRL(Math.abs(this.saldoQ2())));
  readonly formattedSaldoFinal = computed(() => formatBRL(Math.abs(this.saldoFinal())));
}
