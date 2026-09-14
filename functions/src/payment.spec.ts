import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPixOrderBackend } from './payment.js';

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
