import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dunning-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dunning-banner.component.html',
  styleUrl: './dunning-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DunningBannerComponent {
  /**
   * Indica se o usuário está dentro do período de tolerância de 3 dias corridos
   */
  readonly isGracePeriodActive = input<boolean>(false);

  /**
   * Indica se o plano está suspenso por expiração da tolerância ou cancelamento
   */
  readonly isPlanSuspended = input<boolean>(false);

  /**
   * Data formatada de expiração da tolerância (ex: '15/10')
   */
  readonly deadlineFormatted = input<string>('');

  /**
   * Evento emitido ao clicar no botão de regularização da assinatura
   */
  readonly regularize = output<void>();

  /**
   * Visibilidade reativa do banner
   */
  readonly shouldShow = computed(() => this.isGracePeriodActive() || this.isPlanSuspended());

  /**
   * Dispara a ação de regularização
   */
  onRegularizeClick(): void {
    this.regularize.emit();
  }
}
