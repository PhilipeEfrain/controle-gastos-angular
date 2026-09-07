import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { FinanceStore } from '../../core/state/finance.store';
import { AuthStore } from '../../core/state/auth.store';
import { ExpenseService } from '../../core/services/expense.service';
import { MonthlyCycleService } from '../../core/services/monthly-cycle.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserProfile } from '../../core/models/user.model';
import { Expense } from '../../core/models/finance.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockUser: UserProfile = {
    uid: 'user-777',
    email: 'finance@app.com',
    displayName: 'Investidor Pro',
    photoURL: null
  };

  const mockExpense: Expense = {
    id: 'exp-1',
    descricao: 'Conta de Energia',
    valor: 200,
    quinzena: 1,
    categoria: 'Utilidades',
    status_pagamento: false
  };

  let mockFinanceStore: any;
  let mockAuthStore: any;
  let mockExpenseService: any;
  let mockCycleService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockFinanceStore = {
      selectedMonth: signal<string>('2025-03'),
      selectedMonthLabel: signal<string>('Março de 2025'),
      currentCycle: signal<any>({ renda_quinzena_1: 3000, renda_quinzena_2: 2000 }),
      expenses: signal<Expense[]>([mockExpense]),
      taxes: signal<any[]>([]),
      isLoading: signal<boolean>(false),
      error: signal<string | null>(null),
      q1Expenses: signal<Expense[]>([mockExpense]),
      q2Expenses: signal<Expense[]>([]),
      balanceSummary: signal<any>({
        totalRenda: 5000,
        totalGastos: 200,
        saldoFinal: 4800,
        q1: {
          quinzena: 1,
          label: '1ª Quinzena (Dia 31)',
          renda: 3000,
          totalGastos: 200,
          saldo: 2800,
          isDeficit: false,
          percentualGasto: 6.67
        },
        q2: {
          quinzena: 2,
          label: '2ª Quinzena (Dia 15)',
          renda: 2000,
          totalGastos: 0,
          saldo: 2000,
          isDeficit: false,
          percentualGasto: 0
        },
        q1CobreQ2: false,
        temDeficitGlobal: false
      }),
      setSelectedMonth: vi.fn(),
      connectMonthStream: vi.fn(),
      connectTaxesStream: vi.fn()
    };

    mockExpenseService = {
      togglePaymentStatus: vi.fn().mockResolvedValue(undefined),
      deleteExpense: vi.fn().mockResolvedValue(undefined),
      addExpense: vi.fn().mockResolvedValue('exp-new'),
      updateExpense: vi.fn().mockResolvedValue(undefined),
      updateReceiptCode: vi.fn().mockResolvedValue(undefined)
    };

    mockCycleService = {
      saveIncome: vi.fn().mockResolvedValue(undefined)
    };

    mockRouter = {
      navigate: vi.fn()
    };

    const mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: FinanceStore, useValue: mockFinanceStore },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MonthlyCycleService, useValue: mockCycleService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente Dashboard', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o título, seletor de mês e os 4 summary cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Controle Financeiro');
    expect(compiled.textContent).toContain('Março de 2025');
    expect(compiled.textContent).toContain('5.000,00');
    expect(compiled.textContent).toContain('4.800,00');
    expect(compiled.textContent).toContain('Superavitário');
  });

  it('deve abrir e fechar o modal de nova despesa', () => {
    component.openNewExpenseModal(2);
    expect(component.isExpenseModalOpen()).toBe(true);
    expect(component.expenseModalQuinzena()).toBe(2);
    expect(component.expenseToEdit()).toBeNull();
  });

  it('deve abrir o modal de edição de despesa com os dados corretos', () => {
    component.openEditExpenseModal(mockExpense);
    expect(component.isExpenseModalOpen()).toBe(true);
    expect(component.expenseToEdit()).toEqual(mockExpense);
  });

  it('deve abrir o modal de rendas e de comprovante', () => {
    component.openIncomeModal();
    expect(component.isIncomeModalOpen()).toBe(true);

    component.openReceiptModal(mockExpense);
    expect(component.isReceiptModalOpen()).toBe(true);
    expect(component.selectedExpenseForReceipt()).toEqual(mockExpense);
  });

  it('deve abrir o modal de exportação', () => {
    component.openExportModal();
    expect(component.isExportModalOpen()).toBe(true);
  });

  it('deve chamar togglePaymentStatus ao alternar status de despesa', async () => {
    await component.onTogglePaid(mockExpense);
    expect(mockExpenseService.togglePaymentStatus).toHaveBeenCalledWith('user-777', '2025-03', 'exp-1', false);
  });

  it('deve chamar logout e redirecionar para /auth', async () => {
    await component.onLogout();
    expect(mockAuthStore.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth']);
  });
});
