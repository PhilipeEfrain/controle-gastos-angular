import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Expense } from '../../../../core/models/finance.model';
import { formatBRL } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-expense-item-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expense-item-row.component.html',
  styleUrls: ['./expense-item-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseItemRowComponent {
  readonly expense = input.required<Expense>();

  readonly togglePaid = output<Expense>();
  readonly edit = output<Expense>();
  readonly delete = output<Expense>();
  readonly updateReceipt = output<Expense>();

  get formattedAmount(): string {
    return formatBRL(this.expense().valor);
  }

  onCheckboxClick(event: Event): void {
    event.stopPropagation();
    this.togglePaid.emit(this.expense());
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.edit.emit(this.expense());
  }

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.expense());
  }

  onReceiptClick(event: Event): void {
    event.stopPropagation();
    this.updateReceipt.emit(this.expense());
  }
}
