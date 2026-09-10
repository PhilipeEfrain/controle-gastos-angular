import { TestBed } from '@angular/core/testing';
import { PlanLimitsService, PLAN_CONFIGS } from './plan-limits.service';
import { AuthStore } from '../state/auth.store';
import { signal, WritableSignal } from '@angular/core';
import { UserProfile, PlanType } from '../models/user.model';

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;
  let mockCurrentPlan: WritableSignal<PlanType>;
  let mockIsProOrDuo: WritableSignal<boolean>;
  let mockIsDuo: WritableSignal<boolean>;
  let mockIsPlanSuspended: WritableSignal<boolean>;

  beforeEach(() => {
    mockCurrentPlan = signal<PlanType>('free');
    mockIsProOrDuo = signal<boolean>(false);
    mockIsDuo = signal<boolean>(false);
    mockIsPlanSuspended = signal<boolean>(false);

    const mockAuthStore = {
      currentPlan: mockCurrentPlan,
      isProOrDuo: mockIsProOrDuo,
      isDuo: mockIsDuo,
      isPlanSuspended: mockIsPlanSuspended
    };

    TestBed.configureTestingModule({
      providers: [
        PlanLimitsService,
        { provide: AuthStore, useValue: mockAuthStore }
      ]
    });

    service = TestBed.inject(PlanLimitsService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeTruthy();
  });

  describe('Cenários BDD (Plano Free)', () => {
    beforeEach(() => {
      mockCurrentPlan.set('free');
      mockIsProOrDuo.set(false);
      mockIsDuo.set(false);
    });

    it('deve limitar despesas recorrentes em até 3 itens', () => {
      expect(service.checkRecurringExpenseLimit(2).allowed).toBe(true);
      expect(service.checkRecurringExpenseLimit(3).allowed).toBe(false);
      expect(service.checkRecurringExpenseLimit(3).limitMessage).toContain('limite de 3 contas fixas');
    });

    it('deve limitar compras parceladas em até 3 ativas', () => {
      expect(service.checkInstallmentLimit(2).allowed).toBe(true);
      expect(service.checkInstallmentLimit(3).allowed).toBe(false);
      expect(service.checkInstallmentLimit(3).limitMessage).toContain('limite de 3 compras parceladas');
    });

    it('deve limitar tributos anuais em até 1 cadastrado', () => {
      expect(service.checkTaxLimit(0).allowed).toBe(true);
      expect(service.checkTaxLimit(1).allowed).toBe(false);
      expect(service.checkTaxLimit(1).limitMessage).toContain('limite de 1 tributo anual');
    });

    it('deve limitar viagens em até 1 cadastrada', () => {
      expect(service.checkTripLimit(0).allowed).toBe(true);
      expect(service.checkTripLimit(1).allowed).toBe(false);
      expect(service.checkTripLimit(1).limitMessage).toContain('limite de 1 viagem');
    });

    it('deve limitar histórico a 2 meses (atual + anterior)', () => {
      expect(service.isHistoryMonthAllowed(0)).toBe(true);  // mês atual
      expect(service.isHistoryMonthAllowed(-1)).toBe(true); // 1 mês atrás
      expect(service.isHistoryMonthAllowed(-2)).toBe(false); // 2 meses atrás (bloqueado)
    });

    it('não deve permitir exportação em PDF no plano Free', () => {
      expect(service.canExportPdf()).toBe(false);
    });
  });

  describe('Cenários BDD (Plano Pro / Duo)', () => {
    beforeEach(() => {
      mockCurrentPlan.set('pro');
      mockIsProOrDuo.set(true);
      mockIsDuo.set(false);
    });

    it('deve permitir despesas recorrentes ilimitadas', () => {
      expect(service.checkRecurringExpenseLimit(10).allowed).toBe(true);
      expect(service.checkRecurringExpenseLimit(10).maxLimit).toBeNull();
    });

    it('deve permitir parcelamentos ilimitados', () => {
      expect(service.checkInstallmentLimit(15).allowed).toBe(true);
      expect(service.checkInstallmentLimit(15).maxLimit).toBeNull();
    });

    it('deve permitir tributos anuais ilimitados', () => {
      expect(service.checkTaxLimit(10).allowed).toBe(true);
    });

    it('deve permitir viagens ilimitadas', () => {
      expect(service.checkTripLimit(5).allowed).toBe(true);
    });

    it('deve permitir janela de 13 meses de histórico', () => {
      expect(service.isHistoryMonthAllowed(0)).toBe(true);
      expect(service.isHistoryMonthAllowed(-12)).toBe(true); // 12 meses atrás
      expect(service.isHistoryMonthAllowed(-13)).toBe(false); // além de 13 meses
    });

    it('deve permitir exportação em PDF', () => {
      expect(service.canExportPdf()).toBe(true);
    });
  });

  describe('Cenários BDD (Plano Suspenso por Inadimplência Expirada - CARD-040)', () => {
    beforeEach(() => {
      mockCurrentPlan.set('pro');
      mockIsProOrDuo.set(false); // Carência expirada
      mockIsDuo.set(false);
      mockIsPlanSuspended.set(true);
    });

    it('deve restringir cotas ao plano Free quando o PRO estiver suspenso', () => {
      expect(service.checkRecurringExpenseLimit(3).allowed).toBe(false);
      expect(service.checkRecurringExpenseLimit(3).limitMessage).toContain('suspensa');

      expect(service.checkInstallmentLimit(3).allowed).toBe(false);
      expect(service.checkInstallmentLimit(3).limitMessage).toContain('suspensa');

      expect(service.checkTaxLimit(1).allowed).toBe(false);
      expect(service.checkTaxLimit(1).limitMessage).toContain('suspensa');

      expect(service.checkTripLimit(1).allowed).toBe(false);
      expect(service.checkTripLimit(1).limitMessage).toContain('suspensa');
    });

    it('deve restringir histórico e exportação em PDF quando o plano estiver suspenso', () => {
      expect(service.isHistoryMonthAllowed(-2)).toBe(false);
      expect(service.canExportPdf()).toBe(false);
    });
  });
});
