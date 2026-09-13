import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DuoSharedExpense } from '../../../../core/models/duo.model';
import { formatBRL } from '../../../../core/utils/formatters';
import { roundBRL } from '../../../../core/utils/calculations';

@Component({
  selector: 'app-duo-shared-expenses-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './duo-shared-expenses-list.component.html',
  styleUrls: ['./duo-shared-expenses-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DuoSharedExpensesListComponent {
  readonly sharedExpenses = input.required<DuoSharedExpense[]>();
  readonly currentUserId = input<string>('');
  readonly isOwner = input<boolean>(true);
  readonly ownerName = input<string>('Titular');
  readonly partnerName = input<string>('Parceiro(a)');

  readonly addSharedExpense = output<void>();
  readonly togglePayment = output<{ mesAno: string; id: string; status: boolean }>();
  readonly deleteExpense = output<{ mesAno: string; id: string }>();

  readonly totalShared = computed(() => {
    return roundBRL(this.sharedExpenses().reduce((acc, curr) => acc + (curr.valorTotal || 0), 0));
  });

  readonly myShare = computed(() => {
    const isOwnerUser = this.isOwner();
    return roundBRL(
      this.sharedExpenses().reduce((acc, curr) => {
        return acc + (isOwnerUser ? curr.valorOwner || 0 : curr.valorPartner || 0);
      }, 0)
    );
  });

  readonly partnerShare = computed(() => {
    const isOwnerUser = this.isOwner();
    return roundBRL(
      this.sharedExpenses().reduce((acc, curr) => {
        return acc + (isOwnerUser ? curr.valorPartner || 0 : curr.valorOwner || 0);
      }, 0)
    );
  });

  readonly formattedTotalShared = computed(() => formatBRL(this.totalShared()));
  readonly formattedMyShare = computed(() => formatBRL(this.myShare()));
  readonly formattedPartnerShare = computed(() => formatBRL(this.partnerShare()));

  formatValue(val?: number): string {
    return formatBRL(val || 0);
  }

  onToggleStatus(item: DuoSharedExpense): void {
    if (!item.id || !item.mesAno) return;
    this.togglePayment.emit({
      mesAno: item.mesAno,
      id: item.id,
      status: !item.status_pagamento
    });
  }

  onDelete(item: DuoSharedExpense): void {
    if (!item.id || !item.mesAno) return;
    if (confirm(`Deseja remover "${item.descricao}" das despesas compartilhadas?`)) {
      this.deleteExpense.emit({
        mesAno: item.mesAno,
        id: item.id
      });
    }
  }
}
