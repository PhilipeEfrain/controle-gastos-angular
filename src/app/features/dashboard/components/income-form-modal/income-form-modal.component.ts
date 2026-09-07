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
import { MonthlyCycleService } from '../../../../core/services/monthly-cycle.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { formatBRL } from '../../../../core/utils/formatters';
import { roundBRL } from '../../../../core/utils/calculations';
import { SalaryRegime } from '../../../../core/models/finance.model';

@Component({
  selector: 'app-income-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './income-form-modal.component.html',
  styleUrls: ['./income-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncomeFormModalComponent {
  private fb = inject(FormBuilder);
  private cycleService = inject(MonthlyCycleService);
  private authStore = inject(AuthStore);

  readonly isOpen = input<boolean>(false);
  readonly mesAno = input.required<string>();
  readonly currentQ1 = input<number>(0);
  readonly currentQ2 = input<number>(0);
  readonly currentRegime = input<SalaryRegime>('quinzenal');

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    regime: ['quinzenal', [Validators.required]],
    salarioTotal: [null],
    rendaQ1: [0, [Validators.required, Validators.min(0)]],
    rendaQ2: [0, [Validators.required, Validators.min(0)]]
  });

  readonly selectedRegime = computed(() => this.form.get('regime')?.value as SalaryRegime);

  readonly totalRendaCalculada = computed(() => {
    const q1 = parseFloat(this.form.get('rendaQ1')?.value) || 0;
    const q2 = parseFloat(this.form.get('rendaQ2')?.value) || 0;
    return formatBRL(roundBRL(q1 + q2));
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const q1 = this.currentQ1() ?? 0;
        const q2 = this.currentQ2() ?? 0;
        const total = roundBRL(q1 + q2);

        let initialRegime: SalaryRegime = this.currentRegime() || 'quinzenal';
        if (q1 > 0 && q2 === 0) {
          initialRegime = 'mensal_q1';
        } else if (q1 === 0 && q2 > 0) {
          initialRegime = 'mensal_q2';
        } else if (q1 > 0 && q1 === q2) {
          initialRegime = 'divisao_50_50';
        }

        this.form.patchValue({
          regime: initialRegime,
          salarioTotal: total > 0 ? total : null,
          rendaQ1: q1,
          rendaQ2: q2
        });
        this.errorMessage.set(null);
      }
    });
  }

  setRegime(regime: SalaryRegime): void {
    this.form.patchValue({ regime });
    this.applyRegimeCalculation();
  }

  onSalarioTotalChange(): void {
    this.applyRegimeCalculation();
  }

  private applyRegimeCalculation(): void {
    const regime = this.form.get('regime')?.value as SalaryRegime;
    const total = parseFloat(this.form.get('salarioTotal')?.value) || 0;

    if (regime === 'mensal_q1') {
      this.form.patchValue({
        rendaQ1: total,
        rendaQ2: 0
      });
    } else if (regime === 'mensal_q2') {
      this.form.patchValue({
        rendaQ1: 0,
        rendaQ2: total
      });
    } else if (regime === 'divisao_50_50') {
      const half = roundBRL(total / 2);
      this.form.patchValue({
        rendaQ1: half,
        rendaQ2: half
      });
    }
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

    const q1 = parseFloat(this.form.value.rendaQ1) || 0;
    const q2 = parseFloat(this.form.value.rendaQ2) || 0;
    const regime = this.form.value.regime as SalaryRegime;

    try {
      await this.cycleService.saveIncome(user.uid, this.mesAno(), q1, q2, regime);
      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar rendas do ciclo');
    } finally {
      this.isLoading.set(false);
    }
  }
}
