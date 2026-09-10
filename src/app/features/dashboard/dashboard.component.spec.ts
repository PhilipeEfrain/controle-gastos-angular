import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { FinanceStore } from '../../core/state/finance.store';
import { AuthStore } from '../../core/state/auth.store';
import { ExpenseService } from '../../core/services/expense.service';
import { InstallmentService } from '../../core/services/installment.service';
import { PlanLimitsService } from '../../core/services/plan-limits.service';
import { MonthlyCycleService } from '../../core/services/monthly-cycle.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserProfile } from '../../core/models/user.model';
import { Expense } from '../../core/models/finance.model';
import { FirebaseService } from '../../core/services/firebase.service';
import { ExportService } from '../../core/services/export.service';
import { DuoService } from '../../core/services/duo.service';

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
      isProOrDuo: signal<boolean>(false),
      currentPlan: signal<'free' | 'pro' | 'duo'>('free'),
      isDuo: signal<boolean>(false),
      isGracePeriodActive: signal<boolean>(false),
      isPlanSuspended: signal<boolean>(false),
      gracePeriodDeadlineFormatted: signal<string>(''),
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

    const mockInstallmentService = {
      getInstallmentsOverview: vi.fn().mockReturnValue({ pipe: vi.fn(), subscribe: vi.fn() })
    };

    const mockPlanLimitsService = {
      checkRecurringExpenseLimit: vi.fn().mockReturnValue({ allowed: true }),
      checkInstallmentLimit: vi.fn().mockReturnValue({ allowed: true }),
      checkTaxLimit: vi.fn().mockReturnValue({ allowed: true }),
      checkTripLimit: vi.fn().mockReturnValue({ allowed: true }),
      isHistoryMonthAllowed: vi.fn().mockReturnValue(true)
    };

    const mockExportService = {
      exportToCSV: vi.fn(),
      exportToPDF: vi.fn(),
      exportAnnualDossierPDF: vi.fn()
    };

    const mockDuoService = {
      getDuoGroupForUser: vi.fn().mockResolvedValue(null),
      createOrGetDuoGroup: vi.fn().mockResolvedValue(null),
      calculateSettlement: vi.fn().mockReturnValue(null),
      listenDuoGroup: vi.fn().mockReturnValue({ subscribe: vi.fn() })
    };

    const mockFirebaseService = {
      firestore: {},
      auth: {}
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: FinanceStore, useValue: mockFinanceStore },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: MonthlyCycleService, useValue: mockCycleService },
        { provide: InstallmentService, useValue: mockInstallmentService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ExportService, useValue: mockExportService },
        { provide: DuoService, useValue: mockDuoService },
        { provide: FirebaseService, useValue: mockFirebaseService },
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
    expect(compiled.textContent).toContain('Quinzena');
    expect(compiled.textContent).toContain('Saiba quanto entra, quanto sai e quanto sobra.');
    expect(compiled.textContent).toContain('Março de 2025');
    expect(compiled.textContent).toContain('5.000,00');
    expect(compiled.textContent).toContain('4.800,00');
    expect(compiled.textContent).toContain('Seu mês em equilíbrio');
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

  it('Cenário BDD (Janela de Histórico): DEVE permitir navegar para mês anterior quando dentro da janela permitida', () => {
    const planLimits = TestBed.inject(PlanLimitsService);
    vi.spyOn(planLimits, 'isHistoryMonthAllowed').mockReturnValue(true);

    component.prevMonth();

    expect(mockFinanceStore.setSelectedMonth).toHaveBeenCalledWith('2025-02', 'user-777');
  });

  it('Cenário BDD (Janela de Histórico - Free): DEVE exibir modal de limite ao tentar navegar além da janela do Free', () => {
    const planLimits = TestBed.inject(PlanLimitsService);
    vi.spyOn(planLimits, 'isHistoryMonthAllowed').mockReturnValue(false);

    component.prevMonth();

    expect(component.limitModalData()).toEqual(expect.objectContaining({
      title: 'Histórico Completo de 13 Meses',
      resourceName: 'Histórico de 13 Meses'
    }));
  });

  describe('Cenário BDD Onboarding: Checklist de Primeiro Acesso', () => {
    it('deve exibir o checklist de onboarding por padrão se não foi dispensado', () => {
      expect(component.showOnboardingChecklist()).toBe(true);
      expect(component.hasExpenses()).toBe(true);
      expect(component.hasIncomes()).toBe(true);
    });

    it('deve ocultar o checklist de onboarding quando onDismissOnboarding() for chamado', () => {
      component.onDismissOnboarding();
      expect(component.showOnboardingChecklist()).toBe(false);
    });

    it('deve marcar recurso como explorado e navegar para /parcelamentos', () => {
      component.onExploreFeaturesFromOnboarding();
      expect(component.hasExploredFeatures()).toBe(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/parcelamentos']);
    });
  });
});
