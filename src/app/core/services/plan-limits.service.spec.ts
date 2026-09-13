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

    it('deve limitar histórico a 4 meses no Free (3 ativos + 1 carência)', () => {
      expect(service.isHistoryMonthAllowed(0)).toBe(true);  // mês atual
      expect(service.isHistoryMonthAllowed(-1)).toBe(true); // 1 mês atrás
      expect(service.isHistoryMonthAllowed(-2)).toBe(true); // 2 meses atrás
      expect(service.isHistoryMonthAllowed(-3)).toBe(true); // 3 meses atrás (mês de carência)
      expect(service.isHistoryMonthAllowed(-4)).toBe(false); // 4 meses atrás (bloqueado)
    });

    it('deve identificar mês em carência e expirado no Free (3 + 1)', () => {
      expect(service.isCycleInGracePeriod(-3)).toBe(true);
      expect(service.isCycleInGracePeriod(-2)).toBe(false);
      expect(service.isCycleInGracePeriod(-4)).toBe(false);

      expect(service.isCycleExpired(-4)).toBe(true);
      expect(service.isCycleExpired(-3)).toBe(false);
      expect(service.isCycleExpired(-2)).toBe(false);
    });

    it('deve retornar ExpiringCycleInfo para o ciclo de offset -3 no Free', () => {
      const available = ['2026-09', '2026-08', '2026-07', '2026-06'];
      // Em 2026-09, 2026-06 tem offset -3
      const refDate = new Date(2026, 8, 12); // 12 de Setembro de 2026 (Setembro tem 30 dias -> 18 dias restantes)
      const expiring = service.getExpiringCycleInfo(available, '2026-09', refDate);

      expect(expiring).not.toBeNull();
      expect(expiring?.mesAno).toBe('2026-06');
      expect(expiring?.label).toBe('Junho de 2026');
      expect(expiring?.daysRemainingInMonth).toBe(18);
      expect(expiring?.plan).toBe('free');
    });

    it('não deve retornar ExpiringCycleInfo se o ciclo -3 não existir nos ciclos do usuário', () => {
      const available = ['2026-09', '2026-08', '2026-07'];
      const expiring = service.getExpiringCycleInfo(available, '2026-09');
      expect(expiring).toBeNull();
    });

    it('não deve permitir exportação em PDF regular no plano Free', () => {
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

    it('deve permitir janela de 13 meses de histórico (12 ativos + 1 carência)', () => {
      expect(service.isHistoryMonthAllowed(0)).toBe(true);
      expect(service.isHistoryMonthAllowed(-11)).toBe(true); // 11 meses atrás
      expect(service.isHistoryMonthAllowed(-12)).toBe(true); // 12 meses atrás (carência)
      expect(service.isHistoryMonthAllowed(-13)).toBe(false); // além de 13 meses (bloqueado)
    });

    it('deve identificar mês em carência e expirado no Pro (12 + 1)', () => {
      expect(service.isCycleInGracePeriod(-12)).toBe(true);
      expect(service.isCycleInGracePeriod(-11)).toBe(false);
      expect(service.isCycleInGracePeriod(-13)).toBe(false);

      expect(service.isCycleExpired(-13)).toBe(true);
      expect(service.isCycleExpired(-12)).toBe(false);
    });

    it('deve retornar ExpiringCycleInfo para o ciclo de offset -12 no Pro', () => {
      const available = ['2026-09', '2026-08', '2025-09'];
      const refDate = new Date(2026, 8, 12);
      const expiring = service.getExpiringCycleInfo(available, '2026-09', refDate);

      expect(expiring).not.toBeNull();
      expect(expiring?.mesAno).toBe('2025-09');
      expect(expiring?.label).toBe('Setembro de 2025');
      expect(expiring?.daysRemainingInMonth).toBe(18);
      expect(expiring?.plan).toBe('pro');
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
      expect(service.isHistoryMonthAllowed(-4)).toBe(false);
      expect(service.canExportPdf()).toBe(false);
    });
  });
});
