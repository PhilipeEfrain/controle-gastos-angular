import { Component, ChangeDetectionStrategy, input, output, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding-checklist.component.html',
  styleUrls: ['./onboarding-checklist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnboardingChecklistComponent {
  readonly hasIncomes = input<boolean>(false);
  readonly hasExpenses = input<boolean>(false);
  readonly hasExploredFeatures = input<boolean>(false);
  readonly userId = input<string | null>(null);

  readonly defineIncomes = output<void>();
  readonly addExpense = output<void>();
  readonly exploreFeatures = output<void>();
  readonly dismissed = output<void>();

  readonly isDismissedLocally = signal<boolean>(false);

  readonly step1Done = computed(() => this.hasIncomes());
  readonly step2Done = computed(() => this.hasExpenses());
  readonly step3Done = computed(() => this.hasExploredFeatures());

  readonly completedCount = computed(() => {
    let count = 0;
    if (this.step1Done()) count++;
    if (this.step2Done()) count++;
    if (this.step3Done()) count++;
    return count;
  });

  readonly progressPercentage = computed(() => {
    return Math.round((this.completedCount() / 3) * 100);
  });

  readonly isAllCompleted = computed(() => this.completedCount() === 3);

  dismiss(): void {
    const uid = this.userId();
    if (uid) {
      try {
        localStorage.setItem(`onboarding_dismissed_${uid}`, 'true');
      } catch {
        // Ignora em caso de localStorage restrito
      }
    }
    this.isDismissedLocally.set(true);
    this.dismissed.emit();
  }

  onStep1Click(): void {
    this.defineIncomes.emit();
  }

  onStep2Click(): void {
    this.addExpense.emit();
  }

  onStep3Click(): void {
    this.exploreFeatures.emit();
  }
}
