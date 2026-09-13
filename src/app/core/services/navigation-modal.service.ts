import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export type GlobalModalType = 'caixinha' | 'export' | 'newExpense' | null;

@Injectable({
  providedIn: 'root'
})
export class NavigationModalService {
  private readonly router = inject(Router);

  readonly activeModal = signal<GlobalModalType>(null);
  readonly isCaixinhaOpen = signal<boolean>(false);
  readonly isExportOpen = signal<boolean>(false);
  readonly isNewExpenseOpen = signal<boolean>(false);
  readonly newExpenseQuinzena = signal<1 | 2>(1);

  async openCaixinha(): Promise<void> {
    if (!this.isOnDashboard()) {
      await this.router.navigate(['/dashboard'], { queryParams: { action: 'caixinha' } });
    }
    this.activeModal.set('caixinha');
    this.isCaixinhaOpen.set(true);
  }

  closeCaixinha(): void {
    this.isCaixinhaOpen.set(false);
    if (this.activeModal() === 'caixinha') {
      this.activeModal.set(null);
    }
  }

  async openExport(): Promise<void> {
    if (!this.isOnDashboard()) {
      await this.router.navigate(['/dashboard'], { queryParams: { action: 'export' } });
    }
    this.activeModal.set('export');
    this.isExportOpen.set(true);
  }

  closeExport(): void {
    this.isExportOpen.set(false);
    if (this.activeModal() === 'export') {
      this.activeModal.set(null);
    }
  }

  async openNewExpense(quinzena: 1 | 2 = 1): Promise<void> {
    this.newExpenseQuinzena.set(quinzena);
    if (!this.isOnDashboard()) {
      await this.router.navigate(['/dashboard'], { queryParams: { action: 'newExpense', q: quinzena } });
    }
    this.activeModal.set('newExpense');
    this.isNewExpenseOpen.set(true);
  }

  closeNewExpense(): void {
    this.isNewExpenseOpen.set(false);
    if (this.activeModal() === 'newExpense') {
      this.activeModal.set(null);
    }
  }

  private isOnDashboard(): boolean {
    const url = this.router.url ? this.router.url.split('?')[0] : '';
    return url === '/dashboard' || url === '';
  }
}
