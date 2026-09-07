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

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    rendaQ1: [0, [Validators.required, Validators.min(0)]],
    rendaQ2: [0, [Validators.required, Validators.min(0)]]
  });

  readonly totalRendaCalculada = computed(() => {
    const q1 = parseFloat(this.form.get('rendaQ1')?.value) || 0;
    const q2 = parseFloat(this.form.get('rendaQ2')?.value) || 0;
    return formatBRL(roundBRL(q1 + q2));
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.patchValue({
          rendaQ1: this.currentQ1() ?? 0,
          rendaQ2: this.currentQ2() ?? 0
        });
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

    const q1 = parseFloat(this.form.value.rendaQ1) || 0;
    const q2 = parseFloat(this.form.value.rendaQ2) || 0;

    try {
      await this.cycleService.saveIncome(user.uid, this.mesAno(), q1, q2);
      this.saved.emit();
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erro ao salvar rendas do ciclo');
    } finally {
      this.isLoading.set(false);
    }
  }
}
