import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../../core/services/pwa.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-banner.component.html',
  styleUrls: ['./offline-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfflineBannerComponent {
  private pwaService = inject(PwaService);

  readonly isOnline = this.pwaService.isOnline;
  readonly updateAvailable = this.pwaService.updateAvailable;

  reloadApp(): void {
    this.pwaService.activateUpdate();
  }
}
