import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ExpenseFormModalComponent } from './expense-form-modal.component';
import { ExpenseService } from '../../../../core/services/expense.service';
import { InstallmentService } from '../../../../core/services/installment.service';
import { PlanLimitsService } from '../../../../core/services/plan-limits.service';
import { AuthStore } from '../../../../core/state/auth.store';
import { UserProfile } from '../../../../core/models/user.model';

describe('ExpenseFormModalComponent', () => {
  let component: ExpenseFormModalComponent;
  let fixture: ComponentFixture<ExpenseFormModalComponent>;

  let mockExpenseService: any;
  let mockInstallmentService: any;
  let mockPlanLimitsService: any;
  let mockAuthStore: any;
  let mockDuoService: any;

  const mockUser: UserProfile = {
    uid: 'user-123',
    email: 'user@finance.com',
    displayName: 'Usuário Teste',
    photoURL: null,
    plan: 'free'
  };

  beforeEach(async () => {
    mockExpenseService = {
      addExpense: vi.fn().mockResolvedValue('exp-id-1'),
      addRecurringExpense: vi.fn().mockResolvedValue('rec-id-1'),
      updateExpense: vi.fn().mockResolvedValue(undefined),
      createInstallments: vi.fn().mockResolvedValue('group-id-1'),
      getRecurringExpensesStream: vi.fn().mockReturnValue(of([]))
    };

    mockInstallmentService = {
      getInstallmentsOverview: vi.fn().mockReturnValue(of([]))
    };

    mockPlanLimitsService = {
      checkRecurringExpenseLimit: vi.fn().mockReturnValue({
        allowed: true,
        currentCount: 0,
        maxLimit: 3,
        resourceName: 'Contas Fixas Recorrentes',
        limitMessage: ''
      }),
      checkInstallmentLimit: vi.fn().mockReturnValue({
        allowed: true,
        currentCount: 0,
        maxLimit: 3,
        resourceName: 'Compras Parceladas',
        limitMessage: ''
      })
    };

    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      currentPlan: signal('free'),
      isProOrDuo: signal(false)
    };

    mockDuoService = {
      addSharedExpense: vi.fn().mockResolvedValue('shared-1'),
      createSharedInstallments: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [ExpenseFormModalComponent],
      providers: [
        { provide: ExpenseService, useValue: mockExpenseService },
        { provide: InstallmentService, useValue: mockInstallmentService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: (await import('../../../../core/services/duo.service')).DuoService, useValue: mockDuoService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('mesAno', '2025-03');
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve submeter criação de despesa simples', async () => {
    component.form.patchValue({
      descricao: 'Supermercado Mensal',
      valor: 450,
      quinzena: 1,
      categoria: 'Alimentação'
    });

    let savedEmitted = false;
    component.saved.subscribe(() => savedEmitted = true);

    await component.onSubmit();

    expect(mockExpenseService.addExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        descricao: 'Supermercado Mensal',
        valor: 450,
        quinzena: 1,
        categoria: 'Alimentação'
      })
    );
    expect(savedEmitted).toBe(true);
  });

  it('deve submeter compra parcelada com createInstallments usando o valor informado como valor de cada parcela', async () => {
    component.form.patchValue({
      descricao: 'Curso Online',
      valor: 271,
      quinzena: 2,
      categoria: 'Educação',
      isParcelado: true,
      total_parcelas: 32
    });

    const preview = component.installmentPreview;
    expect(preview).not.toBeNull();
    expect(preview?.count).toBe(32);
    expect(preview?.installmentValue).toContain('271,00');
    expect(preview?.totalValue).toContain('8.672,00');

    await component.onSubmit();

    expect(mockExpenseService.createInstallments).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        descricao: 'Curso Online',
        valor: 271,
        quinzena: 2
      }),
      32
    );
  });

  it('deve submeter updateExpense quando expenseToEdit for informado', async () => {
    fixture.componentRef.setInput('expenseToEdit', {
      id: 'exp-edit-1',
      descricao: 'Aluguel Original',
      valor: 1500,
      quinzena: 1,
      categoria: 'Moradia',
      status_pagamento: false
    });
    fixture.detectChanges();

    component.form.patchValue({
      descricao: 'Aluguel Reajustado',
      valor: 1600
    });

    await component.onSubmit();

    expect(mockExpenseService.updateExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      'exp-edit-1',
      expect.objectContaining({
        descricao: 'Aluguel Reajustado',
        valor: 1600
      })
    );
  });

  it('Cenário BDD: deve cadastrar Renda Extra com tipo renda_extra', async () => {
    component.setTipo('renda_extra');

    component.form.patchValue({
      descricao: 'Freelance Design',
      valor: 850,
      quinzena: 2,
      categoria: 'Freelance / Serviços'
    });

    await component.onSubmit();

    expect(mockExpenseService.addExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        tipo: 'renda_extra',
        descricao: 'Freelance Design',
        valor: 850,
        quinzena: 2,
        categoria: 'Freelance / Serviços'
      })
    );
  });

  it('deve submeter criação de despesa recorrente e registrar na coleção mestre', async () => {
    component.form.patchValue({
      descricao: 'Plano de Internet',
      valor: 120,
      quinzena: 1,
      categoria: 'Serviços & Assinaturas',
      recorrente: true
    });

    await component.onSubmit();

    expect(mockExpenseService.addRecurringExpense).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        descricao: 'Plano de Internet',
        valor: 120,
        quinzena: 1,
        categoria: 'Serviços & Assinaturas',
        ativo: true
      })
    );

    expect(mockExpenseService.addExpense).toHaveBeenCalledWith(
      'user-123',
      '2025-03',
      expect.objectContaining({
        descricao: 'Plano de Internet',
        valor: 120,
        quinzena: 1,
        recorrente: true,
        recorrente_id: 'rec-id-1'
      })
    );
  });

  it('Cenário BDD (Feature Gate): DEVE exibir modal de limite ao tentar cadastrar parcelamento além do limite Free', async () => {
    mockPlanLimitsService.checkInstallmentLimit.mockReturnValue({
      allowed: false,
      currentCount: 3,
      maxLimit: 3,
      resourceName: 'Compras Parceladas',
      limitMessage: 'Você atingiu o limite de 3 compras parceladas ativas.'
    });

    component.form.patchValue({
      descricao: 'Geladeira Nova',
      valor: 350,
      quinzena: 1,
      categoria: 'Moradia',
      isParcelado: true,
      total_parcelas: 10
    });

    await component.onSubmit();

    expect(component.limitModalData()).toEqual(expect.objectContaining({
      title: 'Limite de Parcelamentos Atingido',
      resourceName: 'Compras Parceladas'
    }));
    expect(mockExpenseService.createInstallments).not.toHaveBeenCalled();
  });

  it('Cenário BDD (Feature Gate): DEVE exibir modal de limite ao tentar cadastrar conta fixa além do limite Free', async () => {
    mockPlanLimitsService.checkRecurringExpenseLimit.mockReturnValue({
      allowed: false,
      currentCount: 3,
      maxLimit: 3,
      resourceName: 'Contas Fixas Recorrentes',
      limitMessage: 'Você atingiu o limite de 3 contas fixas recorrentes.'
    });

    component.form.patchValue({
      descricao: 'Streaming de Música',
      valor: 35,
      quinzena: 1,
      categoria: 'Serviços & Assinaturas',
      recorrente: true
    });

    await component.onSubmit();

    expect(component.limitModalData()).toEqual(expect.objectContaining({
      title: 'Limite de Contas Fixas Atingido',
      resourceName: 'Contas Fixas Recorrentes'
    }));
    expect(mockExpenseService.addRecurringExpense).not.toHaveBeenCalled();
  });

  it('Cenário BDD: DEVE lançar compra compartilhada (Nossos Gastos) com rateio 50/50 quando no Modo Duo', async () => {
    fixture.componentRef.setInput('isDuo', true);
    fixture.componentRef.setInput('duoGroup', {
      id: 'grp-1',
      ownerId: 'user-123',
      ownerName: 'Philipe',
      partnerId: 'user-456',
      partnerName: 'Mariana',
      status: 'active'
    });
    fixture.detectChanges();

    component.form.patchValue({
      tipo: 'despesa',
      descricao: 'Geladeira Frost Free',
      valor: 2000,
      quinzena: 1,
      categoria: 'Moradia',
      isShared: true,
      tipoDivisao: '50_50',
      pagoPor: 'me',
      isParcelado: false
    });

    await component.onSubmit();

    expect(mockDuoService.addSharedExpense).toHaveBeenCalledWith(
      'grp-1',
      expect.objectContaining({
        descricao: 'Geladeira Frost Free',
        valorTotal: 2000,
        valorOwner: 1000,
        valorPartner: 1000,
        members: ['user-123', 'user-456']
      })
    );
  });
});
