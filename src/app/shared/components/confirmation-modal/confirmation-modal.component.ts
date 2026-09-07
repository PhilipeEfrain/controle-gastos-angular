import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
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
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('Confirmar Ação');
  readonly message = input<string>('Deseja realmente prosseguir com esta ação?');
  readonly confirmButtonText = input<string>('Confirmar');
  readonly cancelButtonText = input<string>('Cancelar');
  readonly variant = input<'danger' | 'primary'>('danger');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
