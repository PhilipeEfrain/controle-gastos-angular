import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MonthlyCycleService } from '../../../../core/services/monthly-cycle.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { SalaryRegime } from '../../../../core/models/finance.model';
import { roundBRL } from '../../../../core/utils/calculations';
import { formatBRL } from '../../../../core/utils/formatters';

export interface PaymentDayPreset {
  id: string;
  label: string;
  sublabel: string;
  defaultQuinzena: 1 | 2 | null;
}

import { CurrencyMaskDirective } from '../../../../shared/directives/currency-mask.directive';

@Component({
  selector: 'app-income-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyMaskDirective],
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
  readonly currentDiaPagamento = input<number | string | null>(null);
  readonly currentDescricaoDiaPagamento = input<string | null>(null);

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly paymentDayPresets: PaymentDayPreset[] = [
    { id: '5_dia_util', label: '5º dia útil', sublabel: 'Aprox. dia 5 a 7', defaultQuinzena: 1 },
    { id: '31', label: 'Virada / Dia 31', sublabel: 'Início do ciclo', defaultQuinzena: 1 },
    { id: '10', label: 'Dia 10', sublabel: '1ª quinzena', defaultQuinzena: 1 },
    { id: '15', label: 'Dia 15', sublabel: 'Meio do mês', defaultQuinzena: 2 },
    { id: '20', label: 'Dia 20', sublabel: '2ª quinzena', defaultQuinzena: 2 },
    { id: 'custom', label: 'Outro Dia', sublabel: '1 a 31', defaultQuinzena: null }
  ];

  form: FormGroup = this.fb.group({
    regime: ['quinzenal', [Validators.required]],
    salarioTotal: [null],
    diaPagamentoPreset: ['5_dia_util'],
    diaCustomizado: [5, [Validators.min(1), Validators.max(31)]],
    rendaQ1: [0, [Validators.required, Validators.min(0)]],
    rendaQ2: [0, [Validators.required, Validators.min(0)]]
  });

  readonly selectedRegime = computed(() => this.form.get('regime')?.value as SalaryRegime);
  readonly selectedPreset = signal<string>('5_dia_util');
  readonly selectedCustomDay = signal<number>(5);

  readonly totalRendaCalculada = computed(() => {
    const q1 = parseFloat(this.form.get('rendaQ1')?.value) || 0;
    const q2 = parseFloat(this.form.get('rendaQ2')?.value) || 0;
    return formatBRL(roundBRL(q1 + q2));
  });

  readonly paymentDayInfo = computed(() => {
    return this.getResolvedPaymentDayInfo();
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const q1 = this.currentQ1() ?? 0;
        const q2 = this.currentQ2() ?? 0;
        const total = roundBRL(q1 + q2);
        const existingDia = this.currentDiaPagamento();

        let initialRegime: SalaryRegime = this.currentRegime() || 'quinzenal';
        let initialPreset = '5_dia_util';
        let initialCustom = 5;

        if (initialRegime === 'mensal_q1') {
          initialRegime = 'mensal_unico';
          initialPreset = '31';
        } else if (initialRegime === 'mensal_q2') {
          initialRegime = 'mensal_unico';
          initialPreset = '15';
        } else if (initialRegime === 'mensal_unico') {
          if (existingDia) {
            const foundPreset = this.paymentDayPresets.find(p => p.id === existingDia.toString());
            if (foundPreset) {
              initialPreset = foundPreset.id;
            } else {
              initialPreset = 'custom';
              const parsedNum = parseInt(existingDia.toString(), 10);
              if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 31) {
                initialCustom = parsedNum;
              }
            }
          }
        } else if (q1 > 0 && q2 === 0) {
          initialRegime = 'mensal_unico';
          initialPreset = existingDia?.toString() || '5_dia_util';
        } else if (q1 === 0 && q2 > 0) {
          initialRegime = 'mensal_unico';
          initialPreset = existingDia?.toString() || '15';
        } else if (q1 > 0 && q1 === q2) {
          initialRegime = 'divisao_50_50';
        }

        this.selectedPreset.set(initialPreset);
        this.selectedCustomDay.set(initialCustom);

        this.form.patchValue({
          regime: initialRegime,
          salarioTotal: total > 0 ? total : null,
          diaPagamentoPreset: initialPreset,
          diaCustomizado: initialCustom,
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

  setPaymentDayPreset(presetId: string): void {
    this.form.patchValue({ diaPagamentoPreset: presetId });
    this.selectedPreset.set(presetId);
    this.applyRegimeCalculation();
  }

  onDiaCustomizadoChange(): void {
    const val = parseInt(this.form.get('diaCustomizado')?.value, 10) || 5;
    this.selectedCustomDay.set(val);
    this.applyRegimeCalculation();
  }

  onSalarioTotalChange(): void {
    this.applyRegimeCalculation();
  }

  getResolvedPaymentDayInfo(): { dia: number | string; descricao: string; quinzena: 1 | 2 } {
    const preset = this.selectedPreset();
    if (preset === '5_dia_util') {
      return { dia: '5_dia_util', descricao: '5º dia útil', quinzena: 1 };
    }
    if (preset === '31') {
      return { dia: 31, descricao: 'Virada / Dia 31', quinzena: 1 };
    }
    if (preset === '10') {
      return { dia: 10, descricao: 'Dia 10', quinzena: 1 };
    }
    if (preset === '15') {
      return { dia: 15, descricao: 'Dia 15', quinzena: 2 };
    }
    if (preset === '20') {
      return { dia: 20, descricao: 'Dia 20', quinzena: 2 };
    }

    const customVal = this.selectedCustomDay();
    const boundedVal = Math.min(31, Math.max(1, customVal));
    const quinzena: 1 | 2 = boundedVal <= 15 ? 1 : 2;
    return { dia: boundedVal, descricao: `Dia ${boundedVal}`, quinzena };
  }

  private applyRegimeCalculation(): void {
    const regime = this.form.get('regime')?.value as SalaryRegime;
    const total = parseFloat(this.form.get('salarioTotal')?.value) || 0;

    if (regime === 'mensal_unico') {
      const info = this.getResolvedPaymentDayInfo();
      if (info.quinzena === 1) {
        this.form.patchValue({ rendaQ1: total, rendaQ2: 0 });
      } else {
        this.form.patchValue({ rendaQ1: 0, rendaQ2: total });
      }
    } else if (regime === 'mensal_q1') {
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

    let diaPagamento: number | string | undefined = undefined;
    let descricaoDiaPagamento: string | undefined = undefined;

    if (regime === 'mensal_unico') {
      const info = this.getResolvedPaymentDayInfo();
      diaPagamento = info.dia;
      descricaoDiaPagamento = info.descricao;
    }

    try {
      await this.cycleService.saveIncome(
        user.uid,
        this.mesAno(),
        q1,
        q2,
        regime,
        diaPagamento,
        descricaoDiaPagamento
      );
      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar rendas do ciclo');
    } finally {
      this.isLoading.set(false);
    }
  }
}
