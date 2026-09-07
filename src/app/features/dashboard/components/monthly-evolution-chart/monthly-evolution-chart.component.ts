import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonthlyCycle } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';

export interface MonthBarData {
  mesAno: string;
  label: string;
  totalRenda: number;
  totalGastos: number;
  saldo: number;
  rendaHeight: number; // 0-100%
  gastosHeight: number; // 0-100%
  isDeficit: boolean;
  isCurrent: boolean;
}

@Component({
  selector: 'app-monthly-evolution-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monthly-evolution-chart.component.html',
  styleUrls: ['./monthly-evolution-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyEvolutionChartComponent {
  readonly cycles = input.required<MonthlyCycle[]>();
  readonly selectedMonth = input<string>('');
  readonly hoveredMonth = signal<string | null>(null);

  readonly chartData = computed<MonthBarData[]>(() => {
    const list = this.cycles();
    if (!list || list.length === 0) return [];

    // Filtrar válidos e ordenar cronologicamente
    const valid = list.filter((c) => !!c && !!c.mesAno);
    if (valid.length === 0) return [];

    const sorted = [...valid].sort((a, b) => (a.mesAno || '').localeCompare(b.mesAno || ''));

    // Pegar o valor máximo para normalização
    let maxVal = 1000;
    for (const c of sorted) {
      const renda = (c.renda_quinzena_1 || 0) + (c.renda_quinzena_2 || 0);
      const gastos = c.total_gastos || 0;
      if (renda > maxVal) maxVal = renda;
      if (gastos > maxVal) maxVal = gastos;
    }

    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    return sorted.map((c) => {
      const totalRenda = (c.renda_quinzena_1 || 0) + (c.renda_quinzena_2 || 0);
      const totalGastos = c.total_gastos || 0;
      const saldo = totalRenda - totalGastos;
      const parts = (c.mesAno || '').split('-');
      const year = parts[0] || '';
      const month = parts[1] || '';
      const monthIndex = month ? parseInt(month, 10) - 1 : 0;
      const label = month ? `${monthNames[monthIndex] || month}/${year?.slice(2)}` : (c.mesAno || '');

      const rendaHeight = maxVal > 0 ? (totalRenda / maxVal) * 100 : 0;
      const gastosHeight = maxVal > 0 ? (totalGastos / maxVal) * 100 : 0;

      return {
        mesAno: c.mesAno,
        label,
        totalRenda,
        totalGastos,
        saldo,
        rendaHeight: Math.min(100, Math.max(4, rendaHeight)),
        gastosHeight: Math.min(100, Math.max(4, gastosHeight)),
        isDeficit: saldo < 0,
        isCurrent: !!this.selectedMonth() && c.mesAno === this.selectedMonth(),
      };
    });
  });

  readonly activeMonthData = computed(() => {
    const hovered = this.hoveredMonth();
    if (!hovered) return null;
    return this.chartData().find((m) => m.mesAno === hovered) || null;
  });

  onMonthHover(mesAno: string | null): void {
    this.hoveredMonth.set(mesAno);
  }

  formatCurrency(val: number): string {
    return formatBRL(val);
  }
}
