import { Component, ChangeDetectionStrategy, input } from '@angular/core';
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
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly variant = input<CardVariant>('default');
  readonly padding = input<CardPadding>('md');
  readonly hoverable = input<boolean>(false);
}
