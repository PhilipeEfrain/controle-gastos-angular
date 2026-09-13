import { Injectable, inject, computed } from '@angular/core';
import { AuthStore } from '../state/auth.store';
import { PlanType } from '../models/user.model';
import {
  formatYearMonthLabel,
  getCurrentYearMonth,
  getMonthOffset,
  getDaysRemainingInCurrentMonth,
  addMonthsToYearMonth
} from '../utils/date';

export interface PlanLimitInfo {
  allowed: boolean;
  currentCount: number;
  maxLimit: number | null; // null indica ilimitado
  resourceName: string;
  limitMessage: string;
}

export interface PlanFeatures {
  maxRecurringExpenses: number;
  maxActiveInstallments: number;
  maxTaxes: number;
  maxTrips: number;
  historyMonths: number;
  activeRetentionMonths: number;
  gracePeriodMonths: number;
  canExportPdf: boolean;
  canUseDuoShared: boolean;
}

export interface ExpiringCycleInfo {
  mesAno: string;
  label: string;
  daysRemainingInMonth: number;
  plan: PlanType;
}

export const PLAN_CONFIGS: Record<PlanType, PlanFeatures> = {
  free: {
    maxRecurringExpenses: 3,
    maxActiveInstallments: 3,
    maxTaxes: 1,
    maxTrips: 1,
    historyMonths: 4,
    activeRetentionMonths: 3,
    gracePeriodMonths: 1,
    canExportPdf: false,
    canUseDuoShared: false
  },
  pro: {
    maxRecurringExpenses: Infinity,
    maxActiveInstallments: Infinity,
    maxTaxes: Infinity,
    maxTrips: Infinity,
    historyMonths: 13,
    activeRetentionMonths: 12,
    gracePeriodMonths: 1,
    canExportPdf: true,
    canUseDuoShared: false
  },
  duo: {
    maxRecurringExpenses: Infinity,
    maxActiveInstallments: Infinity,
    maxTaxes: Infinity,
    maxTrips: Infinity,
    historyMonths: 13,
    activeRetentionMonths: 12,
    gracePeriodMonths: 1,
    canExportPdf: true,
    canUseDuoShared: true
  }
};

@Injectable({
  providedIn: 'root'
})
export class PlanLimitsService {
  private authStore = inject(AuthStore);

  readonly currentPlan = computed<PlanType>(() => this.authStore.currentPlan() || 'free');
  readonly isProOrDuo = computed<boolean>(() => this.authStore.isProOrDuo());
  readonly isDuo = computed<boolean>(() => this.authStore.isDuo());

  readonly currentFeatures = computed<PlanFeatures>(() => {
    // Se o plano estiver suspenso por inadimplência expirada ou cancelamento, aplica cotas do plano Free
    if (!this.isProOrDuo()) {
      return PLAN_CONFIGS.free;
    }
    const plan = this.currentPlan();
    return PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;
  });

  /**
   * Valida se o usuário pode cadastrar uma nova despesa recorrente fixa
   */
  checkRecurringExpenseLimit(currentActiveCount: number): PlanLimitInfo {
    const max = this.currentFeatures().maxRecurringExpenses;
    const isUnlimited = !isFinite(max);
    const allowed = isUnlimited || currentActiveCount < max;

    return {
      allowed,
      currentCount: currentActiveCount,
      maxLimit: isUnlimited ? null : max,
      resourceName: 'Despesas Fixas Recorrentes',
      limitMessage: allowed
        ? ''
        : this.authStore.isPlanSuspended()
          ? 'Sua assinatura PRO está suspensa devido a pagamento pendente. Regularize sua assinatura para cadastrar contas fixas ilimitadas.'
          : `Você atingiu o limite de ${max} contas fixas recorrentes do plano Gratuito. Faça upgrade para o PRO para cadastros ilimitados.`
    };
  }

  /**
   * Valida se o usuário pode cadastrar um novo parcelamento de compras
   */
  checkInstallmentLimit(currentActiveCount: number): PlanLimitInfo {
    const max = this.currentFeatures().maxActiveInstallments;
    const isUnlimited = !isFinite(max);
    const allowed = isUnlimited || currentActiveCount < max;

    return {
      allowed,
      currentCount: currentActiveCount,
      maxLimit: isUnlimited ? null : max,
      resourceName: 'Compras Parceladas',
      limitMessage: allowed
        ? ''
        : this.authStore.isPlanSuspended()
          ? 'Sua assinatura PRO está suspensa devido a pagamento pendente. Regularize sua assinatura para cadastrar compras parceladas ilimitadas.'
          : `Você atingiu o limite de ${max} compras parceladas ativas do plano Gratuito. Faça upgrade para o PRO para compras parceladas ilimitadas.`
    };
  }

  /**
   * Valida se o usuário pode cadastrar um novo tributo anual
   */
  checkTaxLimit(currentCount: number): PlanLimitInfo {
    const max = this.currentFeatures().maxTaxes;
    const isUnlimited = !isFinite(max);
    const allowed = isUnlimited || currentCount < max;

    return {
      allowed,
      currentCount,
      maxLimit: isUnlimited ? null : max,
      resourceName: 'Tributos & Gastos Anuais',
      limitMessage: allowed
        ? ''
        : this.authStore.isPlanSuspended()
          ? 'Sua assinatura PRO está suspensa devido a pagamento pendente. Regularize sua assinatura para controlar tributos e despesas anuais ilimitadas.'
          : `Você atingiu o limite de ${max} tributo anual cadastrado do plano Gratuito. Faça upgrade para o PRO para controlar IPVA, IPTU, Seguros e Anuidades ilimitados.`
    };
  }

  /**
   * Valida se o usuário pode cadastrar uma nova viagem
   */
  checkTripLimit(currentCount: number): PlanLimitInfo {
    const max = this.currentFeatures().maxTrips;
    const isUnlimited = !isFinite(max);
    const allowed = isUnlimited || currentCount < max;

    return {
      allowed,
      currentCount,
      maxLimit: isUnlimited ? null : max,
      resourceName: 'Viagens & Rateios',
      limitMessage: allowed
        ? ''
        : this.authStore.isPlanSuspended()
          ? 'Sua assinatura PRO está suspensa devido a pagamento pendente. Regularize sua assinatura para controlar viagens e rateios ilimitados.'
          : `Você atingiu o limite de ${max} viagem do plano Gratuito. Faça upgrade para o PRO para viagens e rateios ilimitados.`
    };
  }

  /**
   * Valida se o mês solicitado está dentro da janela permitida pelo plano
   * @param monthOffset Distância em meses em relação ao mês atual (0 = atual, -1 = mês anterior, -12 = 1 ano atrás)
   */
  isHistoryMonthAllowed(monthOffset: number): boolean {
    const allowedWindow = this.currentFeatures().historyMonths;
    // monthOffset negativo representa meses no passado
    const pastMonthsCount = Math.abs(Math.min(0, monthOffset));
    return pastMonthsCount < allowedWindow;
  }

  /**
   * Valida se o plano permite exportação de dossiê consolidado em PDF
   */
  canExportPdf(): boolean {
    return this.currentFeatures().canExportPdf;
  }

  /**
   * Verifica se o offset do mês está exatamente no período de carência (+1 mês)
   */
  isCycleInGracePeriod(monthOffset: number): boolean {
    return monthOffset === -this.currentFeatures().activeRetentionMonths;
  }

  /**
   * Verifica se o offset do mês já expirou (além da carência)
   */
  isCycleExpired(monthOffset: number): boolean {
    return monthOffset < -this.currentFeatures().activeRetentionMonths;
  }

  /**
   * Retorna o mês alvo (YYYY-MM) que está no período de carência (+1) para o plano atual
   */
  getGracePeriodMonth(currentMonth: string = getCurrentYearMonth()): string {
    const activeLimit = this.currentFeatures().activeRetentionMonths;
    return addMonthsToYearMonth(currentMonth, -activeLimit);
  }

  /**
   * Identifica se dentre os ciclos informados há algum ciclo atualmente no mês de carência (+1).
   * Retorna os detalhes do ciclo prestes a expirar ou null se nenhum estiver em carência.
   */
  getExpiringCycleInfo(
    availableCycles: string[],
    currentMonth: string = getCurrentYearMonth(),
    referenceDate: Date = new Date()
  ): ExpiringCycleInfo | null {
    if (!availableCycles || availableCycles.length === 0) return null;

    const activeLimit = this.currentFeatures().activeRetentionMonths;
    // O mês em carência é aquele cujo offset é exatamente -activeRetentionMonths
    for (const mesAno of availableCycles) {
      const offset = getMonthOffset(mesAno, currentMonth);
      if (offset === -activeLimit) {
        return {
          mesAno,
          label: formatYearMonthLabel(mesAno),
          daysRemainingInMonth: getDaysRemainingInCurrentMonth(referenceDate),
          plan: this.currentPlan()
        };
      }
    }

    return null;
  }
}
