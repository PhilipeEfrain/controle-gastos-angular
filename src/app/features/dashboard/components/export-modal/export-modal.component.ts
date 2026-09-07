import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportService } from '../../../../core/services/export.service';
import { PlanLimitsService } from '../../../../core/services/plan-limits.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { Expense, MonthBalanceSummary } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly mesAno = input.required<string>();
  readonly expenses = input.required<Expense[]>();
  readonly summary = input.required<MonthBalanceSummary>();
  readonly userName = input<string | undefined>(undefined);

  readonly close = output<void>();
  readonly requestUpgrade = output<void>();

  private readonly exportService = inject(ExportService);
  readonly planLimitsService = inject(PlanLimitsService);
  private readonly authStore = inject(AuthStore);

  readonly currentYear = new Date().getFullYear();
  readonly availableYears = [this.currentYear - 2, this.currentYear - 1, this.currentYear, this.currentYear + 1];
  readonly selectedYear = signal<number>(this.currentYear);
  readonly isGeneratingAnnual = signal<boolean>(false);

  readonly totalLancamentos = computed(() => this.expenses().length);
  readonly formattedRendaTotal = computed(() => formatBRL(this.summary().totalRenda));
  readonly formattedGastosTotal = computed(() => formatBRL(this.summary().totalGastos));
  readonly formattedSaldoFinal = computed(() => formatBRL(this.summary().saldoFinal));

  readonly isProOrDuo = computed(() => this.planLimitsService.canExportPdf());

  onExportCSV(): void {
    this.exportService.exportToCSV(
      this.mesAno(),
      this.expenses(),
      this.summary()
    );
    this.close.emit();
  }

  onExportPDF(): void {
    this.exportService.exportToPDF(
      this.mesAno(),
      this.expenses(),
      this.summary(),
      this.userName()
    );
    this.close.emit();
  }

  async onExportAnnualDossier(): Promise<void> {
    if (!this.planLimitsService.canExportPdf()) {
      this.close.emit();
      this.requestUpgrade.emit();
      return;
    }

    const userId = this.authStore.currentUser()?.uid;
    if (!userId) return;

    this.isGeneratingAnnual.set(true);
    try {
      await this.exportService.exportAnnualDossierPDF(
        this.selectedYear(),
        userId,
        this.userName()
      );
      this.close.emit();
    } catch (err) {
      console.error('Erro ao gerar Dossiê Anual:', err);
      alert('Não foi possível compilar o Dossiê Anual no momento.');
    } finally {
      this.isGeneratingAnnual.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}

