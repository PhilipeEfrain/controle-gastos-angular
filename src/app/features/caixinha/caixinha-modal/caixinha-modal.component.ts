import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CaixinhaService } from '../../../core/services/caixinha.service';
import { AuthStore } from '../../../core/state/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { Caixinha, CaixinhaMovimentacao } from '../../../core/models/caixinha.model';
import { formatBRL } from '../../../core/utils/formatters';
import { roundBRL } from '../../../core/utils/calculations';

@Component({
  selector: 'app-caixinha-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './caixinha-modal.component.html',
  styleUrls: ['./caixinha-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CaixinhaModalComponent implements OnInit {
  readonly isOpen = input<boolean>(false);
  readonly selectedMonth = input<string>(''); // YYYY-MM

  readonly close = output<void>();
  readonly movementSuccess = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly caixinhaService = inject(CaixinhaService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationService = inject(NotificationService);

  readonly caixinha = signal<Caixinha | null>(null);
  readonly movimentacoes = signal<CaixinhaMovimentacao[]>([]);
  readonly activeMode = signal<'view' | 'aporte' | 'resgate' | 'config'>('view');
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly aporteForm: FormGroup;
  readonly resgateForm: FormGroup;
  readonly configForm: FormGroup;

  readonly formattedSaldo = computed(() => {
    return formatBRL(this.caixinha()?.saldo ?? 0);
  });

  readonly formattedMeta = computed(() => {
    const meta = this.caixinha()?.meta;
    return meta ? formatBRL(meta) : null;
  });

  readonly progressPercent = computed(() => {
    const meta = this.caixinha()?.meta;
    const saldo = this.caixinha()?.saldo ?? 0;
    if (!meta || meta <= 0) return null;
    return Math.min(100, Math.round((saldo / meta) * 100));
  });

  constructor() {
    this.aporteForm = this.fb.group({
      valor: ['', [Validators.required, Validators.min(0.01)]],
      observacao: ['']
    });

    this.resgateForm = this.fb.group({
      valor: ['', [Validators.required, Validators.min(0.01)]],
      quinzena: [1, [Validators.required]],
      observacao: ['']
    });

    this.configForm = this.fb.group({
      saldoInicial: [0, [Validators.required, Validators.min(0)]],
      meta: [''],
      nome: ['Reserva de Emergência', [Validators.required]]
    });

    // Recarrega quando o modal é aberto
    effect(() => {
      if (this.isOpen()) {
        this.loadCaixinhaData();
      }
    });
  }

  ngOnInit(): void {
    this.loadCaixinhaData();
  }

  loadCaixinhaData(): void {
    const user = this.authStore.currentUser();
    if (!user) return;

    this.caixinhaService.getCaixinhaStream(user.uid).subscribe(data => {
      this.caixinha.set(data);
      if (data) {
        this.configForm.patchValue({
          saldoInicial: data.saldo,
          meta: data.meta ?? '',
          nome: data.nome ?? 'Reserva de Emergência'
        });
      }
    });

    this.caixinhaService.getMovimentacoesStream(user.uid, 20).subscribe(movs => {
      this.movimentacoes.set(movs);
    });
  }

  setMode(mode: 'view' | 'aporte' | 'resgate' | 'config'): void {
    this.activeMode.set(mode);
    this.errorMessage.set(null);
    this.aporteForm.reset({ valor: '', observacao: '' });
    this.resgateForm.reset({ valor: '', quinzena: 1, observacao: '' });
  }

  onClose(): void {
    this.close.emit();
  }

  async submitAporte(): Promise<void> {
    if (this.aporteForm.invalid) {
      this.aporteForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) return;

    const val = parseFloat(this.aporteForm.value.valor);
    if (isNaN(val) || val <= 0) {
      this.errorMessage.set('Informe um valor de aporte válido.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.caixinhaService.registrarAporte(
        user.uid,
        val,
        this.aporteForm.value.observacao?.trim() || undefined
      );
      this.notificationService.success(`Aporte de ${formatBRL(val)} guardado na caixinha com sucesso! 🐷`);
      this.setMode('view');
      this.movementSuccess.emit();
    } catch (e: any) {
      this.errorMessage.set(e.message || 'Erro ao realizar aporte.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitResgate(): Promise<void> {
    if (this.resgateForm.invalid) {
      this.resgateForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) return;

    const val = parseFloat(this.resgateForm.value.valor);
    const saldo = this.caixinha()?.saldo ?? 0;

    if (isNaN(val) || val <= 0) {
      this.errorMessage.set('Informe um valor de resgate válido.');
      return;
    }

    if (val > saldo) {
      this.errorMessage.set(`Saldo insuficiente na caixinha (Saldo disponível: ${formatBRL(saldo)}).`);
      return;
    }

    const mes = this.selectedMonth() || new Date().toISOString().substring(0, 7);
    const quinzena = Number(this.resgateForm.value.quinzena) as 1 | 2;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.caixinhaService.registrarResgate(
        user.uid,
        val,
        mes,
        quinzena,
        this.resgateForm.value.observacao?.trim() || undefined
      );
      this.notificationService.success(`Resgate de ${formatBRL(val)} adicionado à Quinzena ${quinzena} de ${mes}! 💰`);
      this.setMode('view');
      this.movementSuccess.emit();
    } catch (e: any) {
      this.errorMessage.set(e.message || 'Erro ao realizar resgate.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitConfig(): Promise<void> {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    const user = this.authStore.currentUser();
    if (!user) return;

    const saldo = parseFloat(this.configForm.value.saldoInicial) || 0;
    const metaVal = this.configForm.value.meta ? parseFloat(this.configForm.value.meta) : null;
    const nome = this.configForm.value.nome?.trim() || 'Reserva de Emergência';

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.caixinhaService.initOrUpdateCaixinha(user.uid, saldo, metaVal, nome);
      this.notificationService.success('Parâmetros da caixinha atualizados com sucesso!');
      this.setMode('view');
    } catch (e: any) {
      this.errorMessage.set(e.message || 'Erro ao atualizar caixinha.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
