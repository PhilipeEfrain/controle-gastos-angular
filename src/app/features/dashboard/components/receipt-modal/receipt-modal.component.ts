import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule
} from '@angular/forms';
import { Expense } from '../../../../core/models/finance.model';
import { ExpenseService } from '../../../../core/services/expense.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { formatBRL } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receipt-modal.component.html',
  styleUrls: ['./receipt-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReceiptModalComponent {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  private authStore = inject(AuthStore);

  readonly isOpen = input<boolean>(false);
  readonly expense = input<Expense | null>(null);
  readonly mesAno = input.required<string>();

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    codigoComprovante: ['']
  });

  get expenseDetails(): { descricao: string; valorFormatted: string } | null {
    const exp = this.expense();
    if (!exp) return null;
    return {
      descricao: exp.descricao,
      valorFormatted: formatBRL(exp.valor)
    };
  }

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const exp = this.expense();
        this.form.patchValue({
          codigoComprovante: exp?.codigo_comprovante || ''
        });
        this.errorMessage.set(null);
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    const exp = this.expense();
    if (!exp || !exp.id) {
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) {
      this.errorMessage.set('Usuário não autenticado.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const code = this.form.value.codigoComprovante || '';

    try {
      await this.expenseService.updateReceiptCode(
        user.uid,
        this.mesAno(),
        exp.id,
        code
      );
      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar código de comprovante');
    } finally {
      this.isLoading.set(false);
    }
  }
}
