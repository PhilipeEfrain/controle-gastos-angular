import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaxesComponent } from './taxes.component';
import { FinanceStore } from '../../core/state/finance.store';
import { AuthStore } from '../../core/state/auth.store';
import { TaxService } from '../../core/services/tax.service';
import { PlanLimitsService } from '../../core/services/plan-limits.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserProfile } from '../../core/models/user.model';
import { AnnualTax } from '../../core/models/finance.model';

describe('TaxesComponent', () => {
  let component: TaxesComponent;
  let fixture: ComponentFixture<TaxesComponent>;

  const mockUser: UserProfile = {
    uid: 'user-tax-99',
    email: 'taxes@finance.com',
    displayName: 'Usuário Tributos',
    photoURL: null
  };

  const mockTaxes: AnnualTax[] = [
    {
      id: 'tax-1',
      titulo: 'IPTU 2025',
      valor_orcado: 1200,
      valor_pago: 1200,
      data_vencimento: '2025-02-10',
      ano_referencia: 2025,
      status: 'Pago'
    },
    {
      id: 'tax-2',
      titulo: 'IPVA 2025',
      valor_orcado: 1800,
      valor_pago: 0,
      data_vencimento: '2025-03-15',
      ano_referencia: 2025,
      status: 'Pendente'
    }
  ];

  let mockFinanceStore: any;
  let mockAuthStore: any;
  let mockTaxService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockAuthStore = {
      currentUser: signal<UserProfile | null>(mockUser),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    mockFinanceStore = {
      taxes: signal<AnnualTax[]>(mockTaxes),
      totalTaxesBudget: signal<number>(3000),
      totalTaxesPaid: signal<number>(1200),
      connectTaxesStream: vi.fn()
    };

    mockTaxService = {
      markAsPaid: vi.fn().mockResolvedValue(undefined),
      deleteTax: vi.fn().mockResolvedValue(undefined),
      addTax: vi.fn().mockResolvedValue('tax-new'),
      updateTax: vi.fn().mockResolvedValue(undefined)
    };

    mockRouter = {
      navigate: vi.fn()
    };

    const mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };

    const mockPlanLimitsService = {
      checkTaxLimit: vi.fn().mockReturnValue({
        allowed: true,
        currentCount: 2,
        maxLimit: null,
        resourceName: 'Tributos Anuais',
        limitMessage: ''
      })
    };

    await TestBed.configureTestingModule({
      imports: [TaxesComponent],
      providers: [
        { provide: FinanceStore, useValue: mockFinanceStore },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TaxService, useValue: mockTaxService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaxesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente TaxesComponent', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar a listagem de tributos e card comparativo', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Contas do Ano (IPTU, IPVA e Taxas)');
    expect(compiled.textContent).toContain('IPTU 2025');
    expect(compiled.textContent).toContain('IPVA 2025');
  });

  it('deve filtrar tributos por status', () => {
    component.setFilter('Pendente');
    expect(component.filteredTaxes().length).toBe(1);
    expect(component.filteredTaxes()[0].titulo).toBe('IPVA 2025');

    component.setFilter('Pago');
    expect(component.filteredTaxes().length).toBe(1);
    expect(component.filteredTaxes()[0].titulo).toBe('IPTU 2025');
  });

  it('deve abrir modal de novo tributo e de edição', () => {
    component.openNewTaxModal();
    expect(component.isTaxModalOpen()).toBe(true);
    expect(component.taxToEdit()).toBeNull();

    component.openEditTaxModal(mockTaxes[0]);
    expect(component.isTaxModalOpen()).toBe(true);
    expect(component.taxToEdit()).toEqual(mockTaxes[0]);
  });

  it('deve navegar para /dashboard ao acionar goToDashboard', () => {
    component.goToDashboard();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('Cenário BDD (Feature Gate): DEVE exibir modal de limite ao tentar cadastrar tributo além do limite Free', () => {
    const planLimitsService = TestBed.inject(PlanLimitsService);
    vi.spyOn(planLimitsService, 'checkTaxLimit').mockReturnValue({
      allowed: false,
      currentCount: 1,
      maxLimit: 1,
      resourceName: 'Tributos Anuais',
      limitMessage: 'Você atingiu o limite de 1 tributo anual.'
    });

    component.openNewTaxModal();

    expect(component.isLimitModalOpen()).toBe(true);
    expect(component.isTaxModalOpen()).toBe(false);
    expect(component.limitModalMessage()).toContain('limite de 1 tributo anual');
  });
});
