import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionModalComponent } from '../subscription-modal/subscription-modal.component';

@Component({
  selector: 'app-limit-reached-modal',
  standalone: true,
  imports: [CommonModule, SubscriptionModalComponent],
  templateUrl: './limit-reached-modal.component.html',
  styleUrls: ['./limit-reached-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LimitReachedModalComponent {
  /** Título do recurso que atingiu o limite */
  readonly title = input<string>('Limite do Plano Gratuito Atingido');

  /** Mensagem explicativa customizada do limite atingido */
  readonly message = input<string>(
    'Você atingiu o limite de cadastros do plano Gratuito. Faça upgrade para o PRO para desbloquear recursos ilimitados.'
  );

  /** Recurso específico destacado */
  readonly resourceName = input<string>('Recurso');

  /** Evento emitido ao fechar o modal */
  readonly close = output<void>();

  /** Controle para exibir o modal de assinatura sobreposto */
  readonly isSubscriptionOpen = signal<boolean>(false);

  openSubscription(): void {
    this.isSubscriptionOpen.set(true);
  }

  onSubscriptionClosed(): void {
    this.isSubscriptionOpen.set(false);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
