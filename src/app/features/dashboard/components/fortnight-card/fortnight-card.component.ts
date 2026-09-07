import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FortnightSummary, Expense, FortnightNumber } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';
import { AppCardComponent } from '../../../../shared/components/app-card/app-card.component';
import { BalanceBadgeComponent } from '../../../../shared/components/balance-badge/balance-badge.component';
import { ProgressBarComponent } from '../../../../shared/components/progress-bar/progress-bar.component';
import { ExpenseItemRowComponent } from '../expense-item-row/expense-item-row.component';

@Component({
  selector: 'app-fortnight-card',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    BalanceBadgeComponent,
    ProgressBarComponent,
    ExpenseItemRowComponent
  ],
  templateUrl: './fortnight-card.component.html',
  styleUrls: ['./fortnight-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FortnightCardComponent {
  readonly quinzena = input.required<FortnightNumber>();
  readonly summary = input.required<FortnightSummary>();
  readonly expenses = input<Expense[]>([]);
  readonly isLoading = input<boolean>(false);

  readonly addExpense = output<FortnightNumber>();
  readonly editIncome = output<FortnightNumber>();
  readonly togglePaid = output<Expense>();
  readonly editExpense = output<Expense>();
  readonly deleteExpense = output<Expense>();
  readonly updateReceipt = output<Expense>();

  get title(): string {
    return this.quinzena() === 1 ? '1ª Quinzena' : '2ª Quinzena';
  }

  get referenceDateLabel(): string {
    return this.quinzena() === 1 ? 'Renda do Dia 31' : 'Renda do Dia 15';
  }

  get availabilityHint(): string {
    return this.quinzena() === 1 ? 'disponível até dia 15' : 'previsto até dia 30';
  }

  get formattedIncome(): string {
    return formatBRL(this.summary().renda);
  }

  get formattedTotalGastos(): string {
    return formatBRL(this.summary().totalGastos);
  }

  onAddExpense(): void {
    this.addExpense.emit(this.quinzena());
  }

  onEditIncome(): void {
    this.editIncome.emit(this.quinzena());
  }
}
