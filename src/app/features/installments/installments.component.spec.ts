import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InstallmentsComponent } from './installments.component';
import { InstallmentService } from '../../core/services/installment.service';
import { AuthStore } from '../../core/state/auth.store';
import { NotificationService } from '../../core/services/notification.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { InstallmentGroup } from '../../core/models/finance.model';

describe('InstallmentsComponent', () => {
  let component: InstallmentsComponent;
  let fixture: ComponentFixture<InstallmentsComponent>;

  const mockInstallmentGroups: InstallmentGroup[] = [
    {
      grupo_parcela_id: 'grp-1',
      descricao: 'Sofá Retrátil',
      categoria: 'Moradia',
      valor_parcela: 250,
      total_parcelas: 10,
      parcelas_pagas: 4,
      total_pago: 1000,
      saldo_restante: 1500,
      valor_total: 2500,
      percentual_concluido: 40,
      proximo_vencimento: '2026-10',
      parcelas: [
        { id: 'p1', mesAno: '2026-06', parcela_atual: 1, total_parcelas: 10, valor: 250, status_pagamento: true, quinzena: 1 },
        { id: 'p2', mesAno: '2026-07', parcela_atual: 2, total_parcelas: 10, valor: 250, status_pagamento: true, quinzena: 1 },
        { id: 'p3', mesAno: '2026-08', parcela_atual: 3, total_parcelas: 10, valor: 250, status_pagamento: true, quinzena: 1 },
        { id: 'p4', mesAno: '2026-09', parcela_atual: 4, total_parcelas: 10, valor: 250, status_pagamento: true, quinzena: 1 },
        { id: 'p5', mesAno: '2026-10', parcela_atual: 5, total_parcelas: 10, valor: 250, status_pagamento: false, quinzena: 1 },
      ],
    },
  ];

  let mockInstallmentService: any;
  let mockAuthStore: any;
  let mockNotificationService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockInstallmentService = {
      getInstallmentsOverview: vi.fn(() => of(mockInstallmentGroups)),
      payAdvanceInstallments: vi.fn().mockResolvedValue(undefined),
      deleteInstallmentsBatch: vi.fn().mockResolvedValue(undefined),
    };

    mockAuthStore = {
      currentUser: signal({ uid: 'user-123' }),
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InstallmentsComponent],
      providers: [
        { provide: InstallmentService, useValue: mockInstallmentService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InstallmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente InstallmentsComponent e carregar grupos de parcelamento', () => {
    expect(component).toBeTruthy();
    expect(component.installmentGroups().length).toBe(1);
    expect(component.totalDebtRemaining()).toBe(1500);
    expect(component.totalAlreadyPaid()).toBe(1000);
    expect(component.activePurchasesCount()).toBe(1);
  });

  it('deve abrir o modal de quitação antecipada e selecionar parcela pendente', () => {
    const group = mockInstallmentGroups[0];
    component.openAdvanceModal(group);

    expect(component.isAdvanceModalOpen()).toBe(true);
    expect(component.selectedGroupForAdvance()).toBe(group);
    expect(component.selectedParcelasToPay()).toContain('p5');
    expect(component.totalAdvanceSelectedAmount()).toBe(250);
  });

  it('deve alternar seleção de parcelas no modal de quitação', () => {
    component.selectedGroupForAdvance.set(mockInstallmentGroups[0]);
    component.selectedParcelasToPay.set(['p5']);

    component.toggleParcelaSelection('p5');
    expect(component.selectedParcelasToPay().length).toBe(0);

    component.toggleParcelaSelection('p5');
    expect(component.selectedParcelasToPay()).toContain('p5');
  });

  it('deve chamar payAdvanceInstallments e notificar sucesso ao confirmar quitação', async () => {
    component.selectedGroupForAdvance.set(mockInstallmentGroups[0]);
    component.selectedParcelasToPay.set(['p5']);

    await component.confirmAdvancePayment();

    expect(mockInstallmentService.payAdvanceInstallments).toHaveBeenCalledWith('user-123', [
      { mesAno: '2026-10', expenseId: 'p5' },
    ]);
    expect(mockNotificationService.success).toHaveBeenCalled();
    expect(component.isAdvanceModalOpen()).toBe(false);
  });
});
