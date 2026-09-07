import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportService } from '../../../../core/services/export.service';
import { Expense, MonthBalanceSummary } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule],
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

  private readonly exportService = inject(ExportService);

  readonly totalLancamentos = computed(() => this.expenses().length);
  readonly formattedRendaTotal = computed(() => formatBRL(this.summary().totalRenda));
  readonly formattedGastosTotal = computed(() => formatBRL(this.summary().totalGastos));
  readonly formattedSaldoFinal = computed(() => formatBRL(this.summary().saldoFinal));

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

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
