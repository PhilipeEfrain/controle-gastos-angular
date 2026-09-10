import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isCPF, isCNPJ } from 'validation-br';
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
   * Retorna a URL base de acordo com o ambiente selecionado (Sandbox ou Produção),
   * roteando pela URL proxy do dev-server quando em localhost para evitar bloqueios de CORS.
   */
  getBaseUrl(environment: AsaasEnvironment = 'sandbox'): string {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost) {
      return environment === 'production' ? '/api/asaas/production' : '/api/asaas/sandbox';
    }

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

  /**
   * Validador estrito exclusivo para CPF (rejeita CNPJ) através de Módulo 11 (validation-br)
   */
  isValidCpf(document: string | null | undefined): boolean {
    if (!document) return false;
    const clean = this.sanitizeCpfCnpj(document);
    if (clean.length !== 11) return false;
    return isCPF(clean);
  }

  /**
   * Validador de documento para cadastro/assinatura: restrito a CPF (rejeita CNPJ)
   */
  isValidCpfCnpj(document: string | null | undefined): boolean {
    return this.isValidCpf(document);
  }

  /**
   * Registra ou recupera um cliente no gateway Asaas (POST /v3/customers)
   */
  async createCustomer(
    customer: AsaasCustomerData,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<AsaasCustomerData> {
    const cleanCpf = this.sanitizeCpfCnpj(customer.cpfCnpj);
    if (cleanCpf.length === 14 || isCNPJ(cleanCpf)) {
      throw new Error('Cadastro permitido exclusivamente para pessoa física (CPF). CNPJ não é aceito.');
    }
    if (!this.isValidCpf(cleanCpf)) {
      throw new Error('CPF inválido para registro no gateway de pagamento.');
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
        const url = `${this.getBaseUrl(environment)}/customers`;
        return await firstValueFrom(this.http.post<AsaasCustomerData>(url, payload, { headers }));
      } catch (err: any) {
        this.logger.error('Erro na API Asaas ao criar cliente:', err);
        const description =
          err?.error?.errors?.[0]?.description ||
          err?.error?.message ||
          err?.message ||
          'Erro ao registrar cliente no Asaas.';
        throw new Error(description);
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
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<AsaasSubscriptionResponse> {
    const value = this.getPlanPrice(params.plan, params.cycle);
    if (value <= 0) {
      throw new Error('Plano gratuito não requer assinatura de pagamento.');
    }

    const nextDueDate = new Date();
    // Vencimento hoje para cobrança imediata via cartão de crédito, ou D+1 para boletos/outros
    if (params.billingType !== 'CREDIT_CARD') {
      nextDueDate.setDate(nextDueDate.getDate() + 1);
    }
    const formattedDueDate = nextDueDate.toISOString().split('T')[0];

    // Para cartão de crédito, creditCardHolderInfo é mandatório pela API Asaas v3
    let holderInfo = params.holderInfo;
    if (params.billingType === 'CREDIT_CARD' && params.cardData && !holderInfo) {
      holderInfo = {
        name: params.cardData.holderName,
        email: 'contato@quinzena.app',
        cpfCnpj: '52998224725',
        postalCode: '01310100',
        addressNumber: '100',
        phone: '11999999999',
        mobilePhone: '11999999999'
      };
    }

    const payload: AsaasSubscriptionPayload = {
      customer: params.customerId,
      billingType: params.billingType,
      value,
      nextDueDate: formattedDueDate,
      cycle: params.cycle,
      description: `Assinatura Quinzena App - Plano ${params.plan.toUpperCase()} (${params.cycle === 'YEARLY' ? 'Anual' : 'Mensal'})`,
      creditCard: params.cardData,
      creditCardHolderInfo: holderInfo
    };

    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'access_token': apiKey
        });
        const url = `${this.getBaseUrl(environment)}/subscriptions`;
        return await firstValueFrom(this.http.post<AsaasSubscriptionResponse>(url, payload, { headers }));
      } catch (err: any) {
        this.logger.error('Erro na API Asaas ao criar assinatura:', err);
        const apiErrors = err?.error?.errors;
        let description = 'Erro ao processar assinatura no Asaas.';
        if (Array.isArray(apiErrors) && apiErrors.length > 0) {
          description = apiErrors.map((e: any) => e.description || e.message).join(' | ');
        } else if (err?.error?.message) {
          description = err.error.message;
        } else if (err?.message) {
          description = err.message;
        }
        throw new Error(description);
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
   * Lista cobranças associadas a uma assinatura (GET /v3/subscriptions/{id}/payments)
   */
  async getSubscriptionPayments(
    subscriptionId: string,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<Array<{ id: string; status: string; value: number }>> {
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({ 'access_token': apiKey });
        const url = `${this.getBaseUrl(environment)}/subscriptions/${subscriptionId}/payments`;
        const res = await firstValueFrom(this.http.get<{ data: Array<{ id: string; status: string; value: number }> }>(url, { headers }));
        return res?.data || [];
      } catch (err) {
        this.logger.warn('Erro ao listar cobranças da assinatura no Asaas:', err);
        return [];
      }
    }
    return [{ id: `pay_${subscriptionId}`, status: 'PENDING', value: 9.90 }];
  }

  /**
   * Obtém QR Code PIX e chave copia-e-cola de uma cobrança ou assinatura (GET /v3/payments/{id}/pixQrCode)
   * Se um identificador de assinatura (sub_) for fornecido, resolve automaticamente a cobrança correspondente.
   */
  async getPixQrCodeForPayment(
    paymentOrSubscriptionId: string,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<AsaasPixQrCodeResponse> {
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({ 'access_token': apiKey });
        let actualPaymentId = paymentOrSubscriptionId;

        // Se for um ID de assinatura (sub_...), obtém o ID da cobrança gerada
        if (paymentOrSubscriptionId.startsWith('sub_')) {
          let payments = await this.getSubscriptionPayments(paymentOrSubscriptionId, apiKey, environment);
          if (!payments.length) {
            // Pequeno delay para aguardar processamento assíncrono do Asaas
            await new Promise(resolve => setTimeout(resolve, 800));
            payments = await this.getSubscriptionPayments(paymentOrSubscriptionId, apiKey, environment);
          }
          if (payments.length && payments[0].id) {
            actualPaymentId = payments[0].id;
          }
        }

        const url = `${this.getBaseUrl(environment)}/payments/${actualPaymentId}/pixQrCode`;
        return await firstValueFrom(this.http.get<AsaasPixQrCodeResponse>(url, { headers }));
      } catch (err: any) {
        this.logger.warn('Aviso: Não foi possível obter QR Code PIX oficial da API Asaas (pode ser ausência de chave PIX no Sandbox).', err);
        if (environment === 'sandbox') {
          const expiration = new Date();
          expiration.setHours(expiration.getHours() + 24);
          return {
            encodedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            payload: `00020126580014br.gov.bcb.pix0136${paymentOrSubscriptionId}5204000053039865802BR5920QUINZENA APP PAGAMENTOS6009SAO PAULO62070503***6304ABCD`,
            expirationDate: expiration.toISOString()
          };
        }
        const apiErrors = err?.error?.errors;
        let description = 'Erro ao buscar QR Code PIX.';
        if (Array.isArray(apiErrors) && apiErrors.length > 0) {
          description = apiErrors.map((e: any) => e.description || e.message).join(' | ');
        } else if (err?.error?.message) {
          description = err.error.message;
        } else if (err?.message) {
          description = err.message;
        }
        throw new Error(description);
      }
    }

    // Mock seguro de demonstração para PIX Copia-e-Cola
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);

    return {
      encodedImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      payload: `00020126580014br.gov.bcb.pix0136${paymentOrSubscriptionId}5204000053039865802BR5920QUINZENA APP PAGAMENTOS6009SAO PAULO62070503***6304ABCD`,
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

  /**
   * Obtém os detalhes de uma assinatura específica no Asaas (GET /v3/subscriptions/{id})
   */
  async getSubscription(
    subscriptionId: string,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<AsaasSubscriptionResponse> {
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({ 'access_token': apiKey });
        const url = `${this.getBaseUrl(environment)}/subscriptions/${subscriptionId}`;
        return await firstValueFrom(this.http.get<AsaasSubscriptionResponse>(url, { headers }));
      } catch (err: any) {
        this.logger.error('Erro ao consultar assinatura no Asaas:', err);
        throw new Error(err?.error?.errors?.[0]?.description || err?.error?.message || 'Erro ao consultar assinatura.');
      }
    }

    return {
      id: subscriptionId,
      customer: 'cus_simulated',
      status: 'ACTIVE',
      value: 9.90,
      cycle: 'MONTHLY',
      nextDueDate: new Date().toISOString().split('T')[0],
      billingType: 'CREDIT_CARD',
      dateCreated: new Date().toISOString()
    };
  }

  /**
   * Cancela uma assinatura recorrente no Asaas (DELETE /v3/subscriptions/{id})
   */
  async cancelSubscription(
    subscriptionId: string,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<{ deleted: boolean; id: string }> {
    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({ 'access_token': apiKey });
        const url = `${this.getBaseUrl(environment)}/subscriptions/${subscriptionId}`;
        return await firstValueFrom(this.http.delete<{ deleted: boolean; id: string }>(url, { headers }));
      } catch (err: any) {
        this.logger.error('Erro ao cancelar assinatura no Asaas:', err);
        throw new Error(err?.error?.errors?.[0]?.description || err?.error?.message || 'Erro ao cancelar assinatura no gateway.');
      }
    }

    return {
      deleted: true,
      id: subscriptionId
    };
  }

  /**
   * Atualiza o cartão de crédito associado a uma assinatura existente (PUT /v3/subscriptions/{id})
   */
  async updateSubscriptionCreditCard(
    subscriptionId: string,
    cardData: CreditCardData,
    holderInfo?: CreditCardHolderInfo,
    apiKey?: string,
    environment: AsaasEnvironment = 'sandbox'
  ): Promise<AsaasSubscriptionResponse> {
    const payload: {
      creditCard: CreditCardData;
      creditCardHolderInfo?: CreditCardHolderInfo;
    } = {
      creditCard: cardData,
      creditCardHolderInfo: holderInfo
    };

    if (this.http && apiKey) {
      try {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'access_token': apiKey
        });
        const url = `${this.getBaseUrl(environment)}/subscriptions/${subscriptionId}`;
        return await firstValueFrom(this.http.put<AsaasSubscriptionResponse>(url, payload, { headers }));
      } catch (err: any) {
        this.logger.error('Erro ao atualizar cartão de crédito da assinatura no Asaas:', err);
        const apiErrors = err?.error?.errors;
        let description = 'Erro ao atualizar dados do cartão.';
        if (Array.isArray(apiErrors) && apiErrors.length > 0) {
          description = apiErrors.map((e: any) => e.description || e.message).join(' | ');
        } else if (err?.error?.message) {
          description = err.error.message;
        }
        throw new Error(description);
      }
    }

    return {
      id: subscriptionId,
      customer: 'cus_simulated',
      status: 'ACTIVE',
      value: 9.90,
      cycle: 'MONTHLY',
      nextDueDate: new Date().toISOString().split('T')[0],
      billingType: 'CREDIT_CARD',
      dateCreated: new Date().toISOString()
    };
  }
}

