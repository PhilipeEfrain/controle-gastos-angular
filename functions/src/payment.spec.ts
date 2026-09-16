import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPixOrderBackend,
  createCreditCardOrderBackend,
  cancelSubscriptionBackend,
  updateCreditCardBackend
} from './payment.js';

describe('createPixOrderBackend', () => {
  let mockDb: any;
  let mockUserDoc: any;
  let mockSystemConfigDoc: any;

  beforeEach(() => {
    mockUserDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        asaasCustomerId: 'cus_existing_123'
      })
    };

    mockSystemConfigDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        apiKey: '$aact_valid_key_1234567890',
        environment: 'production'
      })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockUserDoc),
              set: vi.fn().mockResolvedValue(true)
            }))
          };
        }
        if (colName === 'system_config') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockSystemConfigDoc)
            }))
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se o chamador não estiver autenticado', async () => {
    await expect(
      createPixOrderBackend({ plan: 'pro', cpf: '52998224725' }, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve rejeitar CPF inválido', async () => {
    await expect(
      createPixOrderBackend({ plan: 'pro', cpf: '00000000000' }, 'user_123', { db: mockDb })
    ).rejects.toThrow('CPF inválido');
  });

  it('deve criar assinatura PIX e retornar QR code com sucesso', async () => {
    const mockFetch = vi.fn()
      // 1. POST /subscriptions
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'sub_asaas_888', customer: 'cus_existing_123' })
      })
      // 2. GET /subscriptions/sub_asaas_888/payments
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'pay_asaas_999', status: 'PENDING', value: 9.90 }]
        })
      })
      // 3. GET /payments/pay_asaas_999/pixQrCode
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          encodedImage: 'iVBORw0KGgoAAAANSUhEUgAAA...',
          payload: '00020126580014br.gov.bcb.pix...',
          expirationDate: '2026-09-15T23:59:59Z'
        })
      });

    const res = await createPixOrderBackend(
      { plan: 'pro', cpf: '52998224725' },
      'user_123',
      { db: mockDb, fetchFn: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.subscriptionId).toBe('sub_asaas_888');
    expect(res.paymentId).toBe('pay_asaas_999');
    expect(res.payload).toContain('00020126580014br.gov.bcb.pix');
    expect(res.encodedImage).toContain('data:image/png;base64,iVBORw0KGgoAAA');
  });

  it('deve lançar erro descritivo quando o Asaas rejeitar por ausência de chave PIX', async () => {
    const mockFetch = vi.fn()
      // 1. POST /subscriptions
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'sub_asaas_888', customer: 'cus_existing_123' })
      })
      // 2. GET /subscriptions/sub_asaas_888/payments
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'pay_asaas_999', status: 'PENDING' }]
        })
      })
      // 3. GET /payments/pay_asaas_999/pixQrCode -> Falha
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ description: 'Não foi possível gerar o QR Code. É necessário possuir uma chave Pix cadastrada.' }]
        })
      });

    await expect(
      createPixOrderBackend(
        { plan: 'pro', cpf: '52998224725' },
        'user_123',
        { db: mockDb, fetchFn: mockFetch as any }
      )
    ).rejects.toThrow('chave PIX');
  });
});

describe('createCreditCardOrderBackend', () => {
  let mockDb: any;
  let mockUserDoc: any;
  let mockSystemConfigDoc: any;

  beforeEach(() => {
    mockUserDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        asaasCustomerId: 'cus_existing_123'
      })
    };

    mockSystemConfigDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        apiKey: '$aact_valid_key_1234567890',
        environment: 'production'
      })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockUserDoc),
              set: vi.fn().mockResolvedValue(true)
            }))
          };
        }
        if (colName === 'system_config') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockSystemConfigDoc)
            }))
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se o usuário não estiver autenticado', async () => {
    await expect(
      createCreditCardOrderBackend({
        plan: 'pro',
        cpf: '52998224725',
        cardHolderName: 'PHILIPE EFRAIN',
        cardNumber: '4532111122223333',
        cardExpiry: '12/28',
        cardCvv: '123'
      }, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve criar assinatura com cartão de crédito e atualizar perfil do usuário', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'sub_card_123', customer: 'cus_existing_123', status: 'ACTIVE' })
    });

    const res = await createCreditCardOrderBackend({
      plan: 'pro',
      cpf: '52998224725',
      cardHolderName: 'PHILIPE EFRAIN',
      cardNumber: '4532111122223333',
      cardExpiry: '12/28',
      cardCvv: '123'
    }, 'user_123', { db: mockDb, fetchFn: mockFetch as any });

    expect(res.success).toBe(true);
    expect(res.subscriptionId).toBe('sub_card_123');
    expect(res.message).toContain('PRO');
  });

  it('deve lançar erro descritivo quando o Asaas recusar o cartão', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        errors: [{ description: 'Cartão recusado pela operadora (Saldo insuficiente).' }]
      })
    });

    await expect(
      createCreditCardOrderBackend({
        plan: 'pro',
        cpf: '52998224725',
        cardHolderName: 'PHILIPE EFRAIN',
        cardNumber: '4532111122223333',
        cardExpiry: '12/28',
        cardCvv: '123'
      }, 'user_123', { db: mockDb, fetchFn: mockFetch as any })
    ).rejects.toThrow('Saldo insuficiente');
  });
});

describe('cancelSubscriptionBackend', () => {
  let mockDb: any;
  let mockUserDoc: any;
  let mockSystemConfigDoc: any;
  let mockSetFn: any;

  beforeEach(() => {
    mockSetFn = vi.fn().mockResolvedValue(true);
    mockUserDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        asaasCustomerId: 'cus_existing_123',
        asaasSubscriptionId: 'sub_active_123'
      })
    };

    mockSystemConfigDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        apiKey: '$aact_valid_key_1234567890',
        environment: 'production'
      })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockUserDoc),
              set: mockSetFn
            }))
          };
        }
        if (colName === 'system_config') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockSystemConfigDoc)
            }))
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se o usuário não estiver autenticado', async () => {
    await expect(
      cancelSubscriptionBackend({}, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve rejeitar se o usuário tentar cancelar assinatura de outro usuário', async () => {
    await expect(
      cancelSubscriptionBackend({ subscriptionId: 'sub_other_user_456' }, 'user_123', { db: mockDb })
    ).rejects.toThrow('Você não tem permissão para cancelar esta assinatura');
  });

  it('deve enviar DELETE para o Asaas e atualizar perfil no Firestore para canceled', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true, id: 'sub_active_123' })
    });

    const res = await cancelSubscriptionBackend(
      { subscriptionId: 'sub_active_123' },
      'user_123',
      { db: mockDb, fetchFn: mockFetch as any }
    );

    expect(res.success).toBe(true);
    expect(res.deleted).toBe(true);
    expect(res.id).toBe('sub_active_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.asaas.com/v3/subscriptions/sub_active_123',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ planStatus: 'canceled' }),
      { merge: true }
    );
  });

  it('deve lançar erro quando o Asaas falhar no cancelamento', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        errors: [{ description: 'Assinatura não encontrada ou já cancelada.' }]
      })
    });

    await expect(
      cancelSubscriptionBackend({ subscriptionId: 'sub_active_123' }, 'user_123', {
        db: mockDb,
        fetchFn: mockFetch as any
      })
    ).rejects.toThrow('Assinatura não encontrada');
  });
});

describe('updateCreditCardBackend', () => {
  let mockDb: any;
  let mockUserDoc: any;
  let mockSystemConfigDoc: any;

  beforeEach(() => {
    mockUserDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        displayName: 'Philipe Efrain',
        email: 'philipe@example.com',
        asaasCustomerId: 'cus_existing_123',
        asaasSubscriptionId: 'sub_active_123'
      })
    };

    mockSystemConfigDoc = {
      exists: true,
      data: vi.fn().mockReturnValue({
        apiKey: '$aact_valid_key_1234567890',
        environment: 'production'
      })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockUserDoc)
            }))
          };
        }
        if (colName === 'system_config') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockSystemConfigDoc)
            }))
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se o usuário não estiver autenticado', async () => {
    await expect(
      updateCreditCardBackend({
        holderName: 'PHILIPE',
        number: '4532111122223333',
        expiryMonth: '12',
        expiryYear: '28',
        ccv: '123'
      }, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve rejeitar cartão com dados inválidos', async () => {
    await expect(
      updateCreditCardBackend({
        holderName: 'P',
        number: '123',
        expiryMonth: '12',
        expiryYear: '28',
        ccv: '123'
      }, 'user_123', { db: mockDb })
    ).rejects.toThrow('Número de cartão de crédito inválido');
  });

  it('deve enviar PUT ao Asaas e retornar sucesso na atualização do cartão', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'sub_active_123', status: 'ACTIVE' })
    });

    const res = await updateCreditCardBackend({
      subscriptionId: 'sub_active_123',
      holderName: 'PHILIPE EFRAIN',
      number: '4532111122223333',
      expiryMonth: '12',
      expiryYear: '2028',
      ccv: '123'
    }, 'user_123', { db: mockDb, fetchFn: mockFetch as any });

    expect(res.success).toBe(true);
    expect(res.id).toBe('sub_active_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.asaas.com/v3/subscriptions/sub_active_123',
      expect.objectContaining({ method: 'PUT' })
    );
  });
});

