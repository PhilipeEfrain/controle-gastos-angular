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
import { DuoGroup, DuoSharedExpense } from '../../../../core/models/duo.model';
import { ExpenseService } from '../../../../core/services/expense.service';
import { InstallmentService } from '../../../../core/services/installment.service';
import { PlanLimitsService } from '../../../../core/services/plan-limits.service';
import { DuoService } from '../../../../core/services/duo.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { formatBRL } from '../../../../core/utils/formatters';
import { addMonthsToYearMonth, roundBRL } from '../../../../core/utils/calculations';
import { LimitReachedModalComponent } from '../../../../shared/components/limit-reached-modal/limit-reached-modal.component';
import { CurrencyMaskDirective } from '../../../../shared/directives/currency-mask.directive';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-expense-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LimitReachedModalComponent, CurrencyMaskDirective],
  templateUrl: './expense-form-modal.component.html',
  styleUrls: ['./expense-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseFormModalComponent {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  private installmentService = inject(InstallmentService);
  private planLimitsService = inject(PlanLimitsService);
  private duoService = inject(DuoService, { optional: true });
  private authStore = inject(AuthStore);

  readonly isOpen = input<boolean>(false);
  readonly quinzena = input<FortnightNumber>(1);
  readonly expenseToEdit = input<Expense | null>(null);
  readonly mesAno = input.required<string>();
  readonly initialParcelado = input<boolean>(false);
  readonly isDuo = input<boolean>(false);
  readonly duoGroup = input<DuoGroup | null>(null);
  readonly initialShared = input<boolean>(false);

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly limitModalData = signal<{ title: string; message: string; resourceName: string } | null>(null);

  readonly expenseCategories = [
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

  readonly incomeCategories = [
    'Freelance / Serviços',
    'Bônus / PLR',
    'Reembolso',
    'Vendas & Desapego',
    'Rendimentos & Dividendos',
    'Presente / Doação',
    'Outros'
  ];

  form: FormGroup = this.fb.group({
    tipo: ['despesa', [Validators.required]],
    descricao: ['', [Validators.required, Validators.maxLength(100)]],
    valor: [null, [Validators.required, Validators.min(0.01)]],
    quinzena: [1, [Validators.required]],
    categoria: ['Alimentação', [Validators.required]],
    data_vencimento: [''],
    recorrente: [false],
    isParcelado: [false],
    total_parcelas: [2, [Validators.min(2), Validators.max(72)]],
    isShared: [false],
    tipoDivisao: ['50_50'],
    pagoPor: ['me']
  });

  // Preview de parcelas computado
  readonly isParcelado = computed(() => !!this.form.get('isParcelado')?.value);
  readonly isRecorrente = computed(() => !!this.form.get('recorrente')?.value);
  readonly isShared = computed(() => !!this.form.get('isShared')?.value);

  get currentCategories(): string[] {
    return this.form.get('tipo')?.value === 'renda_extra'
      ? this.incomeCategories
      : this.expenseCategories;
  }

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const toEdit = this.expenseToEdit();
        if (toEdit) {
          const itemTipo = toEdit.tipo || 'despesa';
          this.form.patchValue({
            tipo: itemTipo,
            descricao: toEdit.descricao,
            valor: toEdit.valor,
            quinzena: toEdit.quinzena,
            categoria: toEdit.categoria || (itemTipo === 'renda_extra' ? 'Freelance / Serviços' : 'Alimentação'),
            data_vencimento: toEdit.data_vencimento || '',
            recorrente: !!toEdit.recorrente,
            isParcelado: false,
            total_parcelas: 2,
            isShared: false,
            tipoDivisao: '50_50',
            pagoPor: 'me'
          });
        } else {
          const startParcelado = this.initialParcelado();
          const startShared = this.initialShared();
          this.form.reset({
            tipo: 'despesa',
            descricao: '',
            valor: null,
            quinzena: this.quinzena(),
            categoria: 'Alimentação',
            data_vencimento: '',
            recorrente: false,
            isParcelado: startParcelado,
            total_parcelas: 2,
            isShared: startShared,
            tipoDivisao: '50_50',
            pagoPor: 'me'
          });
        }
        this.errorMessage.set(null);
      }
    });
  }

  setTipo(tipo: 'despesa' | 'renda_extra'): void {
    if (this.form.get('tipo')?.value === tipo) return;
    this.form.patchValue({
      tipo,
      categoria: tipo === 'renda_extra' ? 'Freelance / Serviços' : 'Alimentação',
      recorrente: false,
      isParcelado: false
    });
  }

  onRecorrenteChange(): void {
    if (this.form.get('recorrente')?.value) {
      this.form.patchValue({ isParcelado: false });
    }
  }

  onParceladoChange(): void {
    if (this.form.get('isParcelado')?.value) {
      this.form.patchValue({ recorrente: false });
    }
  }

  get installmentPreview(): { count: number; installmentValue: string; totalValue: string; months: string[] } | null {
    const valor = parseFloat(this.form.get('valor')?.value);
    const count = parseInt(this.form.get('total_parcelas')?.value, 10);
    const isParcelado = this.form.get('isParcelado')?.value;

    if (!isParcelado || !valor || isNaN(valor) || !count || isNaN(count) || count < 2) {
      return null;
    }

    const installmentAmount = roundBRL(valor);
    const totalAmount = roundBRL(valor * count);
    const months: string[] = [];
    for (let i = 0; i < count; i++) {
      months.push(addMonthsToYearMonth(this.mesAno(), i));
    }

    return {
      count,
      installmentValue: formatBRL(installmentAmount),
      totalValue: formatBRL(totalAmount),
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
          tipo: formVal.tipo || 'despesa',
          descricao: formVal.descricao.trim(),
          valor: parseFloat(formVal.valor),
          quinzena: Number(formVal.quinzena) as FortnightNumber,
          categoria: formVal.categoria,
          recorrente: !!formVal.recorrente
        };
        if (formVal.data_vencimento?.trim()) {
          updatePayload.data_vencimento = formVal.data_vencimento.trim();
        }

        await this.expenseService.updateExpense(user.uid, this.mesAno(), toEdit.id, updatePayload);
      } else if (formVal.isShared) {
        // Validação defensiva de pareamento ativo no Modo Casal
        const group = this.duoGroup();
        if (!group || !group.id || group.status !== 'active' || !group.partnerId) {
          this.isLoading.set(false);
          this.errorMessage.set('Para lançar gastos compartilhados, é necessário que o seu parceiro(a) esteja conectado no Modo Casal.');
          return;
        }

        // Lançamento de despesa compartilhada do casal (Nossos Gastos)
        const valorTotal = roundBRL(parseFloat(formVal.valor));
        let valorOwner = roundBRL(valorTotal / 2);
        let valorPartner = roundBRL(valorTotal / 2);

        if (formVal.tipoDivisao === '100_titular') {
          valorOwner = valorTotal;
          valorPartner = 0;
        } else if (formVal.tipoDivisao === '100_parceiro') {
          valorOwner = 0;
          valorPartner = valorTotal;
        }

        const isUserOwner = user.uid === group.ownerId;
        let pagoPorId = user.uid;
        let pagoPorNome = user.displayName || 'Você';

        if (formVal.pagoPor === 'partner') {
          pagoPorId = isUserOwner ? group.partnerId! : group.ownerId;
          pagoPorNome = isUserOwner ? (group.partnerName || 'Parceiro(a)') : (group.ownerName || 'Titular');
        } else {
          pagoPorId = isUserOwner ? group.ownerId : group.partnerId!;
          pagoPorNome = isUserOwner ? (group.ownerName || 'Titular') : (group.partnerName || 'Parceiro(a)');
        }

        const validMembers = [group.ownerId, group.partnerId].filter((id): id is string => !!id && typeof id === 'string');

        const baseShared: DuoSharedExpense = {
          descricao: formVal.descricao.trim(),
          valorTotal,
          categoria: formVal.categoria,
          quinzena: Number(formVal.quinzena) as 1 | 2,
          mesAno: this.mesAno(),
          pagoPorId,
          pagoPorNome,
          tipoDivisao: formVal.tipoDivisao || '50_50',
          valorOwner,
          valorPartner,
          status_pagamento: false,
          isParcelado: formVal.isParcelado && formVal.total_parcelas > 1,
          members: validMembers
        };

        if (formVal.data_vencimento?.trim()) {
          baseShared.data_vencimento = formVal.data_vencimento.trim();
        }

        if (formVal.isParcelado && formVal.total_parcelas > 1 && this.duoService) {
          await this.duoService.createSharedInstallments(group.id!, baseShared, formVal.total_parcelas);
        } else if (this.duoService) {
          await this.duoService.addSharedExpense(group.id!, baseShared);
        }

        this.saved.emit();
        this.close.emit();
        return;
      } else if (formVal.tipo !== 'renda_extra' && formVal.isParcelado && formVal.total_parcelas > 1) {
        // Validação de Limite de Compras Parceladas no Plano Free
        try {
          const overview = await firstValueFrom(this.installmentService.getInstallmentsOverview(user.uid));
          const activePurchases = overview.filter(g => g.saldo_restante > 0).length;
          const limitCheck = this.planLimitsService.checkInstallmentLimit(activePurchases);
          if (!limitCheck.allowed) {
            this.isLoading.set(false);
            this.limitModalData.set({
              title: 'Limite de Parcelamentos Atingido',
              message: limitCheck.limitMessage,
              resourceName: 'Compras Parceladas'
            });
            return;
          }
        } catch {
          // Em caso de falha de leitura pontual, prossegue
        }

        // Criação de compra parcelada em lote via writeBatch (o valor cadastrado é o valor de cada parcela)
        const installmentAmount = roundBRL(parseFloat(formVal.valor));
        const baseExpense: Expense = {
          tipo: 'despesa',
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
        // Criação de despesa simples, recorrente ou renda extra
        const isRecorrente = formVal.tipo !== 'renda_extra' && !!formVal.recorrente;
        let recorrenteId: string | undefined;

        if (isRecorrente) {
          // Validação de Limite de Contas Fixas Recorrentes no Plano Free
          try {
            const recurringList = await firstValueFrom(this.expenseService.getRecurringExpensesStream(user.uid));
            const activeRecurring = recurringList.filter(r => r.ativo !== false).length;
            const limitCheck = this.planLimitsService.checkRecurringExpenseLimit(activeRecurring);
            if (!limitCheck.allowed) {
              this.isLoading.set(false);
              this.limitModalData.set({
                title: 'Limite de Contas Fixas Atingido',
                message: limitCheck.limitMessage,
                resourceName: 'Contas Fixas Recorrentes'
              });
              return;
            }
          } catch {
            // Prossegue se stream der timeout
          }

          // Registra na coleção de recorrências mestre
          recorrenteId = await this.expenseService.addRecurringExpense(user.uid, {
            descricao: formVal.descricao.trim(),
            valor: parseFloat(formVal.valor),
            quinzena: Number(formVal.quinzena) as FortnightNumber,
            categoria: formVal.categoria,
            data_vencimento: formVal.data_vencimento?.trim() || '',
            ativo: true
          });
        }

        const newExpense: Expense = {
          tipo: formVal.tipo || 'despesa',
          descricao: formVal.descricao.trim(),
          valor: parseFloat(formVal.valor),
          quinzena: Number(formVal.quinzena) as FortnightNumber,
          categoria: formVal.categoria,
          status_pagamento: false,
          recorrente: isRecorrente,
          recorrente_id: recorrenteId
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
