import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
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
import { CaixinhaService } from '../../core/services/caixinha.service';
import { NavigationModalService } from '../../core/services/navigation-modal.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let queryParamsSubject: BehaviorSubject<any>;

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
  let mockDuoService: any;

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
      connectTaxesStream: vi.fn(),
      connectSharedExpensesStream: vi.fn(),
      sharedExpenses: signal<any[]>([])
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
      isHistoryMonthAllowed: vi.fn().mockReturnValue(true),
      canExportPdf: vi.fn().mockReturnValue(true)
    };

    const mockExportService = {
      exportToCSV: vi.fn(),
      exportToPDF: vi.fn(),
      exportAnnualDossierPDF: vi.fn()
    };

    mockDuoService = {
      getDuoGroupForUser: vi.fn().mockResolvedValue(null),
      createOrGetDuoGroup: vi.fn().mockResolvedValue(null),
      calculateSettlement: vi.fn().mockReturnValue(null),
      listenDuoGroup: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      getSharedExpensesStream: vi.fn().mockReturnValue(of([])),
      toggleSharedExpensePaymentStatus: vi.fn().mockResolvedValue(undefined),
      deleteSharedExpense: vi.fn().mockResolvedValue(undefined)
    };

    const mockCaixinhaService = {
      getCaixinhaStream: vi.fn().mockReturnValue(of(null)),
      getMovimentacoesStream: vi.fn().mockReturnValue(of([])),
      registrarAporte: vi.fn().mockResolvedValue(undefined),
      registrarResgate: vi.fn().mockResolvedValue(undefined),
      initOrUpdateCaixinha: vi.fn().mockResolvedValue(undefined)
    };

    const mockFirebaseService = {
      firestore: {},
      auth: {}
    };

    queryParamsSubject = new BehaviorSubject<any>({});

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
        { provide: CaixinhaService, useValue: mockCaixinhaService },
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { queryParams: queryParamsSubject.asObservable() } }
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

  describe('Cenário BDD: Indicador de Renda Extra no Saldo Consolidado', () => {
    it('deve exibir indicador * no saldo consolidado quando hasExtraIncome for true', () => {
      mockFinanceStore.balanceSummary.set({
        totalRenda: 5800,
        totalGastos: 200,
        saldoFinal: 5600,
        hasExtraIncome: true,
        totalExtraIncome: 800,
        q1: { saldo: 3600, isDeficit: false, hasExtraIncome: true, totalExtraIncome: 800 },
        q2: { saldo: 2000, isDeficit: false, hasExtraIncome: false, totalExtraIncome: 0 },
        temDeficitGlobal: false
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const indicator = el.querySelector('.summary-value .extra-income-indicator') as HTMLElement;
      expect(indicator).toBeTruthy();
      expect(indicator.textContent?.trim()).toBe('*');
      expect(indicator.getAttribute('title')).toContain('Saldo com acréscimo de renda extra');
      expect(indicator.getAttribute('title')).toContain('800,00');
    });

    it('NÃO deve exibir indicador * no saldo consolidado quando hasExtraIncome for false', () => {
      mockFinanceStore.balanceSummary.set({
        totalRenda: 5000,
        totalGastos: 200,
        saldoFinal: 4800,
        hasExtraIncome: false,
        totalExtraIncome: 0,
        q1: { saldo: 2800, isDeficit: false, hasExtraIncome: false },
        q2: { saldo: 2000, isDeficit: false, hasExtraIncome: false },
        temDeficitGlobal: false
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const indicator = el.querySelector('.summary-value .extra-income-indicator');
      expect(indicator).toBeNull();
    });
  });

  describe('Cenário BDD: Abertura Direta em Modo Parcelado', () => {
    it('openNewExpenseModal com isParcelado=true deve sinalizar modal parcelado', () => {
      component.openNewExpenseModal(1, true);

      expect(component.isExpenseModalOpen()).toBe(true);
      expect(component.isExpenseModalParcelado()).toBe(true);
      expect(component.expenseModalQuinzena()).toBe(1);
    });
  });

  describe('Cenário BDD (CARD-061): Desbloqueio e Pareamento do Modo Casal (Duo)', () => {
    it('deve identificar isDuoPendingPairing=true quando usuário é Duo e não possui parceiro conectado', () => {
      (mockAuthStore.isDuo as any).set(true);
      component.duoGroup.set({
        id: 'grp-1',
        ownerId: 'user-123',
        ownerEmail: 'user@test.com',
        ownerName: 'Titular',
        partnerId: null,
        inviteCode: 'DUO-9999',
        status: 'pending'
      });
      fixture.detectChanges();

      expect(component.isDuoPendingPairing()).toBe(true);
    });

    it('deve renderizar o banner de pareamento pendente e abrir o modal ao clicar em Conectar Parceiro', () => {
      (mockAuthStore.isDuo as any).set(true);
      component.duoGroup.set({
        id: 'grp-1',
        ownerId: 'user-123',
        ownerEmail: 'user@test.com',
        ownerName: 'Titular',
        partnerId: null,
        inviteCode: 'DUO-9999',
        status: 'pending'
      });
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const bannerBtn = el.querySelector('#btn-duo-connect-dashboard') as HTMLButtonElement;
      expect(bannerBtn).toBeTruthy();

      bannerBtn.click();
      fixture.detectChanges();

      expect(component.isDuoPairingModalOpen()).toBe(true);
    });

    it('onOpenDuoPairingFromSubscription deve fechar modal de assinatura e abrir pareamento de casal', () => {
      component.isSubscriptionModalOpen.set(true);
      component.isDuoPairingModalOpen.set(false);

      component.onOpenDuoPairingFromSubscription();

      expect(component.isSubscriptionModalOpen()).toBe(false);
      expect(component.isDuoPairingModalOpen()).toBe(true);
    });

    it('onDuoPairingModalClosed deve fechar modal de pareamento, limpar initialDuoCode e atualizar grupo', async () => {
      component.isDuoPairingModalOpen.set(true);
      component.initialDuoCode.set('DUO-1234');
      await component.onDuoPairingModalClosed();

      expect(component.isDuoPairingModalOpen()).toBe(false);
      expect(component.initialDuoCode()).toBe('');
      expect(mockDuoService.getDuoGroupForUser).toHaveBeenCalledWith('user-777');
    });

    it('Cenário BDD (CARD-062): deve capturar duoCode da URL, abrir modal e limpar parâmetro', () => {
      queryParamsSubject.next({ duoCode: 'DUO-7842' });

      expect(component.initialDuoCode()).toBe('DUO-7842');
      expect(component.isDuoPairingModalOpen()).toBe(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: {},
        replaceUrl: true
      });
    });

    it('Cenário BDD (CARD-062): deve ignorar duoCode com formato inválido', () => {
      queryParamsSubject.next({ duoCode: 'INVALID-CODE' });

      expect(component.initialDuoCode()).toBe('');
      expect(component.isDuoPairingModalOpen()).toBe(false);
    });

    it('Cenário BDD (CARD-066): deve alternar entre abas Meus Gastos, Nossos Gastos e Visão 50/50', () => {
      mockAuthStore.isDuo.set(true);
      component.duoGroup.set({
        id: 'grp-1',
        ownerId: 'user-777',
        ownerEmail: 'philipe@test.com',
        ownerName: 'Philipe',
        partnerId: 'user-888',
        partnerName: 'Mariana',
        inviteCode: 'DUO-1234',
        status: 'active'
      });
      fixture.detectChanges();

      expect(component.isDuoActive()).toBe(true);
      expect(component.activeDuoTab()).toBe('meus');

      // Alterna para Nossos Gastos
      component.activeDuoTab.set('nossos');
      fixture.detectChanges();
      expect(component.activeDuoTab()).toBe('nossos');

      // Alterna para Visão 50/50
      component.activeDuoTab.set('visao');
      fixture.detectChanges();
      expect(component.activeDuoTab()).toBe('visao');
    });

    it('Cenário BDD (CARD-068): deve gerenciar abertura do modal da caixinha de emergência', () => {
      expect(component.isCaixinhaModalOpen()).toBe(false);
      component.isCaixinhaModalOpen.set(true);
      expect(component.isCaixinhaModalOpen()).toBe(true);

      component.onCaixinhaMovementSuccess();
      expect(mockFinanceStore.setSelectedMonth).toHaveBeenCalledWith('2025-03', 'user-777');
    });

    it('Cenário BDD (CARD-069): deve sincronizar modais disparados via NavigationModalService', () => {
      const navService = TestBed.inject(NavigationModalService);

      expect(component.isCaixinhaModalOpen()).toBe(false);
      navService.isCaixinhaOpen.set(true);
      TestBed.flushEffects();
      expect(component.isCaixinhaModalOpen()).toBe(true);

      component.onCaixinhaModalClosed();
      expect(component.isCaixinhaModalOpen()).toBe(false);
      expect(navService.isCaixinhaOpen()).toBe(false);

      expect(component.isExportModalOpen()).toBe(false);
      navService.isExportOpen.set(true);
      TestBed.flushEffects();
      expect(component.isExportModalOpen()).toBe(true);

      component.onExportModalClosed();
      expect(component.isExportModalOpen()).toBe(false);
      expect(navService.isExportOpen()).toBe(false);
    });
  });
});
