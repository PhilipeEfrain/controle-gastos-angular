import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationModalComponent {
  readonly isOpen = input<boolean>(true);
  readonly title = input<string>('Confirmar Ação');
  readonly message = input<string>('Deseja realmente prosseguir com esta ação?');
  readonly confirmButtonText = input<string>('Confirmar');
  readonly cancelButtonText = input<string>('Cancelar');
  readonly confirmText = input<string | undefined>(undefined);
  readonly cancelText = input<string | undefined>(undefined);
  readonly variant = input<'danger' | 'primary'>('danger');

  readonly resolvedConfirmText = computed(() => this.confirmText() || this.confirmButtonText());
  readonly resolvedCancelText = computed(() => this.cancelText() || this.cancelButtonText());

  readonly confirm = output<void>();
  readonly cancel = output<void>();
  readonly close = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
    this.close.emit();
  }
}
