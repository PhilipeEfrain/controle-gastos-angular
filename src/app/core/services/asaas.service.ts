import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LoggerService } from './logger.service';
import {
  BillingCycle,
  PaymentBillingType,
  PlanPricing,
  AsaasCustomerData,
  AsaasSubscriptionPayload,
  AsaasSubscriptionResponse,
  AsaasPixQrCodeResponse,
  AsaasWebhookPayload,
  CreditCardData,
  CreditCardHolderInfo,
  AsaasEnvironment
} from '../models/payment.model';
import { PlanType, PlanStatus } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AsaasService {
  private http = inject(HttpClient, { optional: true });
  private logger = inject(LoggerService);

  /**
   * Configuração de ambiente e endpoints da API Asaas v3
   */
  readonly API_CONFIG = {
    sandboxUrl: 'https://sandbox.asaas.com/api/v3',
    productionUrl: 'https://api.asaas.com/v3',
    defaultCycle: 'MONTHLY' as BillingCycle
  };

  /**
   * Retorna a URL base de acordo com o ambiente selecionado (Sandbox ou Produção)
   */
  getBaseUrl(environment: AsaasEnvironment = 'sandbox'): string {
    return environment === 'production' ? this.API_CONFIG.productionUrl : this.API_CONFIG.sandboxUrl;
  }

  /**
   * Tabela Oficial de Preços e Recursos do Quinzena App
   */
  readonly PRICING_TABLE: PlanPricing[] = [
    {
      plan: 'free',
      name: 'Free (Gratuito)',
      badge: 'Básico',
      monthlyPrice: 0,
      yearlyPrice: 0,
      yearlyEquivalentMonthly: 0,
      discountPercentage: 0,
      features: [
        'Acesso aos ciclos quinzenais (Q1 e Q2)',
        'Histórico limitado a 2 meses',
        'Até 3 compras parceladas ativas',
        'Até 3 despesas fixas recorrentes',
        '1 tributo anual e 1 viagem ativa',
        'Modo Offline com sincronização'
      ]
    },
    {
      plan: 'pro',
      name: 'Pro Individual',
      badge: 'Mais Popular',
      monthlyPrice: 9.90,
      yearlyPrice: 0,
      yearlyEquivalentMonthly: 0,
      discountPercentage: 0,
      features: [
        'Tudo do plano Free',
        'Histórico de 13 meses (12+1)',
        'Dossiê Anual Consolidado em PDF',
        'Compras parceladas ilimitadas',
        'Despesas fixas recorrentes ilimitadas',
        'Viagens e tributos anuais ilimitados',
        'Gráficos avançados de evolução financeira'
      ]
    },
    {
      plan: 'duo',
      name: 'Casal / Duo',
      badge: 'Família',
      monthlyPrice: 19.90,
      yearlyPrice: 0,
      yearlyEquivalentMonthly: 0,
      discountPercentage: 0,
      features: [
        'Tudo do plano Pro Individual',
        '2 contas independentes conectadas',
        'Rateio inteligente de despesas do casal',
        'Dossiê Anual Conjunto em PDF',
        'Visão unificada e individual de orçamento',
        'Suporte prioritário via WhatsApp'
      ]
    }
  ];

  /**
   * Retorna a tabela completa de planos com preços e recursos
   */
  getPricingTable(): PlanPricing[] {
    return this.PRICING_TABLE;
  }

  /**
   * Retorna o valor de cobrança mensal com base no plano
   */
  getPlanPrice(plan: PlanType, cycle: BillingCycle = 'MONTHLY'): number {
    const config = this.PRICING_TABLE.find(p => p.plan === plan);
    if (!config) return 0;
    return config.monthlyPrice;
  }

  /**
   * Validador estrutural e sanitizador de CPF / CNPJ (apenas dígitos)
   */
  sanitizeCpfCnpj(document: string): string {
    return (document || '').replace(/\D/g, '');
  }

  isValidCpfCnpj(document: string): boolean {
    const clean = this.sanitizeCpfCnpj(document);
    // CPF: 11 dígitos / CNPJ: 14 dígitos
    return clean.length === 11 || clean.length === 14;
  }

  /**
   * Registra ou recupera um cliente no gateway Asaas (POST /v3/customers)
   */
  async createCustomer(customer: AsaasCustomerData, apiKey?: string): Promise<AsaasCustomerData> {
    const cleanCpf = this.sanitizeCpfCnpj(customer.cpfCnpj);
    if (!this.isValidCpfCnpj(cleanCpf)) {
      throw new Error('CPF ou CNPJ inválido para registro no gateway de pagamento.');
    }

    const payload: AsaasCustomerData = {
      ...customer,
      cpfCnpj: cleanCpf
    };

    // Em produção ou com backend/Cloud Functions, efetua chamada HTTP
    // Em ambiente de teste/demonstração, gera identificador simulado
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'access_token': apiKey
        });
        const url = `${this.API_CONFIG.sandboxUrl}/customers`;
        return await this.http.post<AsaasCustomerData>(url, payload, { headers }).toPromise() as AsaasCustomerData;
      } catch (err) {
        this.logger.error('Erro na API Asaas ao criar cliente:', err);
        throw err;
      }
    }

    return {
      id: `cus_${Math.random().toString(36).substring(2, 10)}`,
      ...payload
    };
  }

  /**
   * Cria uma assinatura recorrente no Asaas (POST /v3/subscriptions)
   */
  async createSubscription(
    params: {
      plan: PlanType;
      cycle: BillingCycle;
      billingType: PaymentBillingType;
      customerId: string;
      cardData?: CreditCardData;
      holderInfo?: CreditCardHolderInfo;
    },
    apiKey?: string
  ): Promise<AsaasSubscriptionResponse> {
    const value = this.getPlanPrice(params.plan, params.cycle);
    if (value <= 0) {
      throw new Error('Plano gratuito não requer assinatura de pagamento.');
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const formattedDueDate = nextDueDate.toISOString().split('T')[0];

    const payload: AsaasSubscriptionPayload = {
      customer: params.customerId,
      billingType: params.billingType,
      value,
      nextDueDate: formattedDueDate,
      cycle: params.cycle,
      description: `Assinatura Quinzena App - Plano ${params.plan.toUpperCase()} (${params.cycle === 'YEARLY' ? 'Anual' : 'Mensal'})`,
      creditCard: params.cardData,
      creditCardHolderInfo: params.holderInfo
    };

    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'access_token': apiKey
        });
        const url = `${this.API_CONFIG.sandboxUrl}/subscriptions`;
        return await this.http.post<AsaasSubscriptionResponse>(url, payload, { headers }).toPromise() as AsaasSubscriptionResponse;
      } catch (err) {
        this.logger.error('Erro na API Asaas ao criar assinatura:', err);
        throw err;
      }
    }

    return {
      id: `sub_${Math.random().toString(36).substring(2, 10)}`,
      customer: params.customerId,
      status: 'ACTIVE',
      value,
      cycle: params.cycle,
      nextDueDate: formattedDueDate,
      billingType: params.billingType,
      dateCreated: new Date().toISOString()
    };
  }

  /**
   * Obtém QR Code PIX e chave copia-e-cola de uma cobrança (GET /v3/payments/{id}/pixQrCode)
   */
  async getPixQrCodeForPayment(paymentId: string, apiKey?: string): Promise<AsaasPixQrCodeResponse> {
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({ 'access_token': apiKey });
        const url = `${this.API_CONFIG.sandboxUrl}/payments/${paymentId}/pixQrCode`;
        return await this.http.get<AsaasPixQrCodeResponse>(url, { headers }).toPromise() as AsaasPixQrCodeResponse;
      } catch (err) {
        this.logger.error('Erro ao buscar QR Code PIX no Asaas:', err);
        throw err;
      }
    }

    // Mock seguro de demonstração para PIX Copia-e-Cola
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);

    return {
      encodedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      payload: `00020126580014br.gov.bcb.pix0136${paymentId}5204000053039865802BR5920QUINZENA APP PAGAMENTOS6009SAO PAULO62070503***6304ABCD`,
      expirationDate: expiration.toISOString()
    };
  }

  /**
   * Processamento e validação de Webhooks do Asaas com verificação de token de segurança
   */
  processWebhookEvent(
    payload: AsaasWebhookPayload,
    receivedAccessToken?: string,
    expectedAccessToken?: string
  ): {
    success: boolean;
    shouldUpdatePlan: boolean;
    newPlanStatus?: PlanStatus;
    error?: string;
  } {
    // Validação estrita do token de webhook (CWE-306 / Mitigação de requisições forjadas)
    if (expectedAccessToken && receivedAccessToken !== expectedAccessToken) {
      this.logger.error('Tentativa de webhook com token inválido ou não autorizado.');
      return {
        success: false,
        shouldUpdatePlan: false,
        error: 'Token de autenticação do webhook inválido.'
      };
    }

    const { event, payment } = payload;
    if (!event || !payment) {
      return {
        success: false,
        shouldUpdatePlan: false,
        error: 'Payload de webhook incompleto ou malformado.'
      };
    }

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        return {
          success: true,
          shouldUpdatePlan: true,
          newPlanStatus: 'active'
        };

      case 'PAYMENT_OVERDUE':
        return {
          success: true,
          shouldUpdatePlan: true,
          newPlanStatus: 'past_due'
        };

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        return {
          success: true,
          shouldUpdatePlan: true,
          newPlanStatus: 'canceled'
        };

      default:
        return {
          success: true,
          shouldUpdatePlan: false
        };
    }
  }
}
