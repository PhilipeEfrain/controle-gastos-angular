import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Expense, FortnightNumber } from '../../../../core/models/finance.model';
import { ExpenseService } from '../../../../core/services/expense.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { formatBRL } from '../../../../core/utils/formatters';
import { addMonthsToYearMonth, roundBRL } from '../../../../core/utils/calculations';

@Component({
  selector: 'app-expense-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expense-form-modal.component.html',
  styleUrls: ['./expense-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseFormModalComponent {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  private authStore = inject(AuthStore);

  readonly isOpen = input<boolean>(false);
  readonly quinzena = input<FortnightNumber>(1);
  readonly expenseToEdit = input<Expense | null>(null);
  readonly mesAno = input.required<string>();

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly categories = [
    'Alimentação',
    'Moradia',
    'Transporte',
    'Saúde & Bem-estar',
    'Educação',
    'Lazer & Viagem',
    'Serviços & Assinaturas',
    'Investimentos',
    'Tributos & Impostos',
    'Outros'
  ];

  form: FormGroup = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(100)]],
    valor: [null, [Validators.required, Validators.min(0.01)]],
    quinzena: [1, [Validators.required]],
    categoria: ['Alimentação', [Validators.required]],
    data_vencimento: [''],
    isParcelado: [false],
    total_parcelas: [2, [Validators.min(2), Validators.max(72)]]
  });

  // Preview de parcelas computado
  readonly isParcelado = computed(() => !!this.form.get('isParcelado')?.value);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const toEdit = this.expenseToEdit();
        if (toEdit) {
          this.form.patchValue({
            descricao: toEdit.descricao,
            valor: toEdit.valor,
            quinzena: toEdit.quinzena,
            categoria: toEdit.categoria || 'Alimentação',
            data_vencimento: toEdit.data_vencimento || '',
            isParcelado: false,
            total_parcelas: 2
          });
        } else {
          this.form.reset({
            descricao: '',
            valor: null,
            quinzena: this.quinzena(),
            categoria: 'Alimentação',
            data_vencimento: '',
            isParcelado: false,
            total_parcelas: 2
          });
        }
        this.errorMessage.set(null);
      }
    });
  }

  get installmentPreview(): { count: number; installmentValue: string; months: string[] } | null {
    const valor = this.form.get('valor')?.value;
    const count = this.form.get('total_parcelas')?.value;
    const isParcelado = this.form.get('isParcelado')?.value;

    if (!isParcelado || !valor || !count || count < 2) {
      return null;
    }

    const installmentAmount = roundBRL(valor / count);
    const months: string[] = [];
    for (let i = 0; i < count; i++) {
      months.push(addMonthsToYearMonth(this.mesAno(), i));
    }

    return {
      count,
      installmentValue: formatBRL(installmentAmount),
      months
    };
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
    const toEdit = this.expenseToEdit();

    try {
      if (toEdit && toEdit.id) {
        // Atualização de despesa existente
        const updatePayload: Partial<Expense> = {
          descricao: formVal.descricao.trim(),
          valor: parseFloat(formVal.valor),
          quinzena: Number(formVal.quinzena) as FortnightNumber,
          categoria: formVal.categoria
        };
        if (formVal.data_vencimento?.trim()) {
          updatePayload.data_vencimento = formVal.data_vencimento.trim();
        }

        await this.expenseService.updateExpense(user.uid, this.mesAno(), toEdit.id, updatePayload);
      } else if (formVal.isParcelado && formVal.total_parcelas > 1) {
        // Criação de compra parcelada em lote via writeBatch
        const installmentAmount = roundBRL(parseFloat(formVal.valor) / formVal.total_parcelas);
        const baseExpense: Expense = {
          descricao: formVal.descricao.trim(),
          valor: installmentAmount,
          quinzena: Number(formVal.quinzena) as FortnightNumber,
          categoria: formVal.categoria,
          status_pagamento: false
        };
        if (formVal.data_vencimento?.trim()) {
          baseExpense.data_vencimento = formVal.data_vencimento.trim();
        }

        await this.expenseService.createInstallments(
          user.uid,
          this.mesAno(),
          baseExpense,
          formVal.total_parcelas
        );
      } else {
        // Criação de despesa simples
        const newExpense: Expense = {
          descricao: formVal.descricao.trim(),
          valor: parseFloat(formVal.valor),
          quinzena: Number(formVal.quinzena) as FortnightNumber,
          categoria: formVal.categoria,
          status_pagamento: false
        };
        if (formVal.data_vencimento?.trim()) {
          newExpense.data_vencimento = formVal.data_vencimento.trim();
        }

        await this.expenseService.addExpense(user.uid, this.mesAno(), newExpense);
      }

      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar despesa');
    } finally {
      this.isLoading.set(false);
    }
  }
}
