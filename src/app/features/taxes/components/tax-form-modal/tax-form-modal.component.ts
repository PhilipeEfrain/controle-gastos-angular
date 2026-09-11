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
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { AnnualTax } from '../../../../core/models/finance.model';
import { TaxService } from '../../../../core/services/tax.service';
import { AuthStore } from '../../../../core/state/auth.store';

import { CurrencyMaskDirective } from '../../../../shared/directives/currency-mask.directive';

@Component({
  selector: 'app-tax-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyMaskDirective],
  templateUrl: './tax-form-modal.component.html',
  styleUrls: ['./tax-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxFormModalComponent {
  private fb = inject(FormBuilder);
  private taxService = inject(TaxService);
  private authStore = inject(AuthStore);

  readonly isOpen = input<boolean>(false);
  readonly taxToEdit = input<AnnualTax | null>(null);

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(100)]],
    valor_orcado: [null, [Validators.required, Validators.min(0.01)]],
    data_vencimento: ['', [Validators.required]],
    ano_referencia: [new Date().getFullYear(), [Validators.required]],
    status: ['Pendente', [Validators.required]],
    valor_pago: [0]
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const toEdit = this.taxToEdit();
        if (toEdit) {
          this.form.patchValue({
            titulo: toEdit.titulo,
            valor_orcado: toEdit.valor_orcado,
            data_vencimento: toEdit.data_vencimento,
            ano_referencia: toEdit.ano_referencia || new Date().getFullYear(),
            status: toEdit.status || 'Pendente',
            valor_pago: toEdit.valor_pago || 0
          });
        } else {
          this.form.reset({
            titulo: '',
            valor_orcado: null,
            data_vencimento: '',
            ano_referencia: new Date().getFullYear(),
            status: 'Pendente',
            valor_pago: 0
          });
        }
        this.errorMessage.set(null);
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) {
      this.errorMessage.set('Usuário não autenticado.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formVal = this.form.value;
    const toEdit = this.taxToEdit();

    try {
      const taxPayload: AnnualTax = {
        titulo: formVal.titulo.trim(),
        valor_orcado: parseFloat(formVal.valor_orcado),
        data_vencimento: formVal.data_vencimento,
        ano_referencia: Number(formVal.ano_referencia),
        status: formVal.status,
        valor_pago: formVal.status === 'Pago' ? parseFloat(formVal.valor_pago || 0) : 0
      };

      if (toEdit && toEdit.id) {
        await this.taxService.updateTax(user.uid, toEdit.id, taxPayload);
      } else {
        await this.taxService.addTax(user.uid, taxPayload);
      }

      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar tributo anual');
    } finally {
      this.isLoading.set(false);
    }
  }
}
