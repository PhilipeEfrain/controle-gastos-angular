import { Component, ChangeDetectionStrategy, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpiringCycleInfo } from '../../../../core/services/plan-limits.service';

@Component({
  selector: 'app-expiring-data-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expiring-data-modal.component.html',
  styleUrls: ['./expiring-data-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiringDataModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly info = input<ExpiringCycleInfo | null>(null);
  readonly isDownloading = input<boolean>(false);

  readonly downloadPdf = output<string>();
  readonly upgrade = output<void>();
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onDownload(): void {
    const currentInfo = this.info();
    if (!currentInfo || this.isDownloading()) return;
    this.downloadPdf.emit(currentInfo.mesAno);
  }

  onUpgrade(): void {
    this.upgrade.emit();
  }
}
