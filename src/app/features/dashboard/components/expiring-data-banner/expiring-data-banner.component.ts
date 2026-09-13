import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpiringCycleInfo } from '../../../../core/services/plan-limits.service';

@Component({
  selector: 'app-expiring-data-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expiring-data-banner.component.html',
  styleUrls: ['./expiring-data-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiringDataBannerComponent {
  readonly info = input.required<ExpiringCycleInfo>();
  readonly isDownloading = input<boolean>(false);

  readonly downloadPdf = output<string>();
  readonly dismiss = output<void>();

  onDownload(): void {
    if (this.isDownloading()) return;
    this.downloadPdf.emit(this.info().mesAno);
  }

  onDismiss(): void {
    this.dismiss.emit();
  }
}
