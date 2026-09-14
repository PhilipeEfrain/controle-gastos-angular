import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NavigationModalService } from '../../../core/services/navigation-modal.service';

@Component({
  selector: 'app-feedback-fab',
  standalone: true,
  template: `
    <button
      type="button"
      class="feedback-fab"
      (click)="openFeedback()"
      aria-label="Enviar feedback ou reportar erro"
      title="Feedback & Reportar Erro"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="fab-icon">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227
             1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443
             1.11 1.11 0 0 0 .634-.174C19.252 14.56 21 12.276 21 9.75
             c0-3.728-3.81-6.75-8.5-6.75S4 6.022 4 9.75c0 .413.036.818.106 1.214
             A8.14 8.14 0 0 0 2.25 13.01Z" />
      </svg>
    </button>
  `,
  styleUrls: ['./feedback-fab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackFabComponent {
  private readonly navModalService = inject(NavigationModalService);

  openFeedback(): void {
    this.navModalService.openFeedback();
  }
}
