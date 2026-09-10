import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleAsaasWebhook,
  calculatePlanExpiration,
  calculateGracePeriodExpiration
} from './webhook-handler.js';
import type { AsaasWebhookPayload } from './types.js';

describe('Webhook Asaas - Funções Utilitárias', () => {
  it('deve calcular a data de expiração adicionando 30 dias à data de vencimento', () => {
    const dueDate = '2026-10-01';
    const expiresAt = calculatePlanExpiration(dueDate);
    const expDate = new Date(expiresAt);
    expect(expDate.getUTCFullYear()).toBe(2026);
    expect(expDate.getUTCMonth()).toBe(9); // Outubro (0-indexed = 9) + 30 dias cai em 31/10
    expect(expDate.getUTCDate()).toBe(31);
  });

  it('deve calcular o Grace Period adicionando 3 dias corridos (D+3)', () => {
    const before = new Date();
    const graceIso = calculateGracePeriodExpiration();
    const graceDate = new Date(graceIso);
    const diffDays = Math.round((graceDate.getTime() - before.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(3);
  });
});

describe('Webhook Asaas - handleAsaasWebhook', () => {
  let mockUserData: Record<string, any>;
  let mockUserUpdate: ReturnType<typeof vi.fn>;
  let mockAuditSet: ReturnType<typeof vi.fn>;
  let mockAuditDocExists: boolean;
  let mockDb: any;

  beforeEach(() => {
    mockUserData = {
      uid: 'user-123',
      email: 'usuario@teste.com',
      plan: 'free',
      planStatus: 'trial',
      asaasCustomerId: 'cus_111',
      asaasSubscriptionId: 'sub_222'
    };

    mockUserUpdate = vi.fn().mockResolvedValue({});
    mockAuditSet = vi.fn().mockResolvedValue({});
    mockAuditDocExists = false;

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn((uid: string) => ({
              id: uid,
              get: vi.fn().mockResolvedValue({
                exists: uid === 'user-123',
                id: uid,
                data: () => mockUserData
              }),
              update: mockUserUpdate
            })),
            where: vi.fn((field: string, op: string, val: string) => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({
                  empty: val !== 'cus_111' && val !== 'sub_222',
                  docs: [
                    {
                      id: 'user-123',
                      ref: {
                        id: 'user-123',
                        get: vi.fn().mockResolvedValue({
                          exists: true,
                          id: 'user-123',
                          data: () => mockUserData
                        }),
                        update: mockUserUpdate
                      }
                    }
                  ]
                })
              }))
            }))
          };
        }

        if (colName === 'system_events') {
          return {
            doc: vi.fn((docId: string) => {
              if (docId === 'webhooks') {
                return {
                  collection: vi.fn((subCol: string) => ({
                    doc: vi.fn((eventId: string) => ({
                      id: eventId,
                      get: vi.fn().mockResolvedValue({
                        exists: mockAuditDocExists
                      }),
                      set: mockAuditSet
                    }))
                  }))
                };
              }
              return {
                get: vi.fn().mockResolvedValue({ exists: false })
              };
            })
          };
        }

        if (colName === 'system_config') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ webhookSecret: 'secret_token_123' })
              })
            }))
          };
        }

        return {};
      })
    };
  });

  // Requisito SEC / CWE-306
  it('deve retornar HTTP 401 Unauthorized se o token de webhook for inválido ou ausente', async () => {
    const payload: AsaasWebhookPayload = {
      id: 'evt_001',
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_1',
        customer: 'cus_111',
        subscription: 'sub_222',
        value: 9.90,
        billingType: 'CREDIT_CARD',
        status: 'RECEIVED'
      }
    };

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'token_errado' },
      payload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.message).toContain('inválido ou ausente');
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  // Requisito de Validação de Payload
  it('deve retornar HTTP 400 Bad Request se o payload não possuir event', async () => {
    const invalidPayload = {} as AsaasWebhookPayload;

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'secret_token_123' },
      invalidPayload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  // Cenário BDD 4: Idempotência de eventos repetidos
  it('deve retornar HTTP 200 com alreadyProcessed=true se o evento já foi processado anteriormente', async () => {
    mockAuditDocExists = true;

    const payload: AsaasWebhookPayload = {
      id: 'evt_duplicado_999',
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_1',
        customer: 'cus_111',
        subscription: 'sub_222',
        value: 9.90,
        billingType: 'PIX',
        status: 'RECEIVED'
      }
    };

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'secret_token_123' },
      payload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.alreadyProcessed).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  // Cenário BDD 1: Confirmação de Renovação Mensal
  it('deve processar PAYMENT_RECEIVED ativando o plano e limpando carência pendente', async () => {
    const payload: AsaasWebhookPayload = {
      id: 'evt_recebido_01',
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        customer: 'cus_111',
        subscription: 'sub_222',
        value: 9.90,
        billingType: 'CREDIT_CARD',
        status: 'RECEIVED',
        dueDate: '2026-10-15',
        externalReference: 'user-123'
      }
    };

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'secret_token_123' },
      payload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.actionTaken).toBe('PLAN_ACTIVATED_OR_RENEWED');

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: 'active',
        plan: 'pro',
        gracePeriodExpiresAt: null
      })
    );

    expect(mockAuditSet).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_recebido_01',
        event: 'PAYMENT_RECEIVED',
        actionTaken: 'PLAN_ACTIVATED_OR_RENEWED',
        userId: 'user-123'
      })
    );
  });

  // Cenário BDD 2: Notificação de Atraso e Inadimplência
  it('deve processar PAYMENT_OVERDUE definindo planStatus=past_due e calculando Grace Period em D+3', async () => {
    const payload: AsaasWebhookPayload = {
      id: 'evt_overdue_02',
      event: 'PAYMENT_OVERDUE',
      payment: {
        id: 'pay_456',
        customer: 'cus_111',
        subscription: 'sub_222',
        value: 9.90,
        billingType: 'CREDIT_CARD',
        status: 'OVERDUE',
        externalReference: 'user-123'
      }
    };

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'secret_token_123' },
      payload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.actionTaken).toBe('GRACE_PERIOD_STARTED');

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: 'past_due',
        gracePeriodExpiresAt: expect.any(String)
      })
    );
  });

  // Cenário BDD 3: Cancelamento de Assinatura pelo Gateway
  it('deve processar SUBSCRIPTION_INACTIVATED rebaixando para plano free e status canceled', async () => {
    const payload: AsaasWebhookPayload = {
      id: 'evt_cancel_03',
      event: 'SUBSCRIPTION_INACTIVATED',
      subscription: {
        id: 'sub_222',
        customer: 'cus_111',
        status: 'INACTIVE',
        externalReference: 'user-123'
      }
    };

    const result = await handleAsaasWebhook(
      { 'asaas-access-token': 'secret_token_123' },
      payload,
      { db: mockDb, getWebhookSecret: async () => 'secret_token_123' }
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.actionTaken).toBe('PLAN_CANCELED');

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: 'canceled',
        plan: 'free',
        inactivationReason: 'SUBSCRIPTION_INACTIVATED'
      })
    );
  });
});
