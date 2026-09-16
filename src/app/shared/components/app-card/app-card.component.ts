import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardVariant = 'default' | 'success' | 'danger' | 'warning' | 'primary';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-card.component.html',
  styleUrl: './app-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppCardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() variant: CardVariant = 'default';
  @Input() padding: CardPadding = 'md';
  @Input() hoverable: boolean = false;
}
