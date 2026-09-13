import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DuoGroup, DuoSettlementSummary } from '../../../../core/models/duo.model';
import { formatBRL } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-duo-settlement-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './duo-settlement-card.component.html',
  styleUrls: ['./duo-settlement-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DuoSettlementCardComponent {
  readonly group = input.required<DuoGroup>();
  readonly settlement = input.required<DuoSettlementSummary>();

  readonly openPairingModal = output<void>();

  readonly formattedOwnerTotal = computed(() => formatBRL(this.settlement().ownerTotalPaid));
  readonly formattedPartnerTotal = computed(() => formatBRL(this.settlement().partnerTotalPaid));
  readonly formattedTotalShared = computed(() => formatBRL(this.settlement().totalShared));
  readonly formattedTargetShare = computed(() => formatBRL(this.settlement().targetSharePerPerson));

  readonly ownerPercent = computed(() => {
    const total = this.settlement().totalShared;
    if (total === 0) return 50;
    return Math.round((this.settlement().ownerTotalPaid / total) * 100);
  });

  readonly partnerPercent = computed(() => {
    return 100 - this.ownerPercent();
  });
}
