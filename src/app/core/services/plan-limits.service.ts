import { Injectable, inject, computed } from '@angular/core';
import { AuthStore } from '../state/auth.store';
import { PlanType } from '../models/user.model';

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
  canExportPdf: boolean;
  canUseDuoShared: boolean;
}

export const PLAN_CONFIGS: Record<PlanType, PlanFeatures> = {
  free: {
    maxRecurringExpenses: 3,
    maxActiveInstallments: 3,
    maxTaxes: 1,
    maxTrips: 1,
    historyMonths: 2,
    canExportPdf: false,
    canUseDuoShared: false
  },
  pro: {
    maxRecurringExpenses: Infinity,
    maxActiveInstallments: Infinity,
    maxTaxes: Infinity,
    maxTrips: Infinity,
    historyMonths: 13,
    canExportPdf: true,
    canUseDuoShared: false
  },
  duo: {
    maxRecurringExpenses: Infinity,
    maxActiveInstallments: Infinity,
    maxTaxes: Infinity,
    maxTrips: Infinity,
    historyMonths: 13,
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
}
