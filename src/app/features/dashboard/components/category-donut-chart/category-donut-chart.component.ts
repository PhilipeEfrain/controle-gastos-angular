import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Expense } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';

export interface CategorySpending {
  category: string;
  total: number;
  percentage: number;
  color: string;
  count: number;
  dashArray: string;
  dashOffset: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Moradia: '#6366f1', // Indigo
  Alimentação: '#10b981', // Emerald
  Transporte: '#f59e0b', // Amber
  Saúde: '#ef4444', // Rose/Carmine
  Lazer: '#ec4899', // Pink
  Educação: '#8b5cf6', // Purple
  'Serviços & Assinaturas': '#06b6d4', // Cyan
  Serviços: '#06b6d4',
  Outros: '#94a3b8', // Slate
};

const DEFAULT_COLOR = '#64748b';
const CIRCUMFERENCE = 2 * Math.PI * 70; // r = 70 -> ~439.82

@Component({
  selector: 'app-category-donut-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-donut-chart.component.html',
  styleUrls: ['./category-donut-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDonutChartComponent {
  readonly expenses = input.required<Expense[]>();
  readonly hoveredCategory = signal<string | null>(null);

  readonly totalExpenses = computed(() => {
    return this.expenses()
      .filter((e) => e.tipo !== 'renda_extra')
      .reduce((acc, curr) => acc + (curr.valor || 0), 0);
  });

  readonly categoriesSpending = computed<CategorySpending[]>(() => {
    const total = this.totalExpenses();
    const map = new Map<string, { total: number; count: number }>();

    for (const exp of this.expenses()) {
      if (exp.tipo === 'renda_extra') continue;
      const cat = exp.categoria || 'Outros';
      const existing = map.get(cat) || { total: 0, count: 0 };
      existing.total += exp.valor || 0;
      existing.count += 1;
      map.set(cat, existing);
    }

    let accumulatedOffset = 0;
    const result: CategorySpending[] = [];

    map.forEach((data, category) => {
      const percentage = total > 0 ? (data.total / total) * 100 : 0;
      const strokeLength = total > 0 ? (data.total / total) * CIRCUMFERENCE : 0;
      const dashArray = `${strokeLength} ${CIRCUMFERENCE - strokeLength}`;
      const dashOffset = -accumulatedOffset;
      accumulatedOffset += strokeLength;

      result.push({
        category,
        total: data.total,
        percentage,
        color: CATEGORY_COLORS[category] || DEFAULT_COLOR,
        count: data.count,
        dashArray,
        dashOffset,
      });
    });

    return result.sort((a, b) => b.total - a.total);
  });

  readonly activeCategoryData = computed(() => {
    const hovered = this.hoveredCategory();
    if (!hovered) return null;
    return this.categoriesSpending().find((c) => c.category === hovered) || null;
  });

  onCategoryHover(category: string | null): void {
    this.hoveredCategory.set(category);
  }

  formatCurrency(val: number): string {
    return formatBRL(val);
  }
}
