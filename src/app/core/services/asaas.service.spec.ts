import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AsaasService } from './asaas.service';
import { LoggerService } from './logger.service';
import { AsaasWebhookPayload } from '../models/payment.model';

describe('AsaasService (Gateway de Pagamentos & Assinaturas)', () => {
  let service: AsaasService;
  let mockLoggerService: any;

  beforeEach(() => {
    mockLoggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AsaasService,
        { provide: LoggerService, useValue: mockLoggerService }
      ]
    });

    service = TestBed.inject(AsaasService);
  });

  it('deve ser instanciado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  describe('Tabela de Preços e Cálculos de Planos', () => {
    it('Cenário BDD: deve retornar os preços oficiais dos planos Mensal e Anual', () => {
      expect(service.getPlanPrice('free')).toBe(0);
      expect(service.getPlanPrice('pro', 'MONTHLY')).toBe(9.90);
      expect(service.getPlanPrice('pro', 'YEARLY')).toBe(89.90);
      expect(service.getPlanPrice('duo', 'MONTHLY')).toBe(19.90);
      expect(service.getPlanPrice('duo', 'YEARLY')).toBe(179.90);
    });

    it('Cenário BDD: deve fornecer lista completa de 3 planos com recursos', () => {
      const table = service.getPricingTable();
      expect(table.length).toBe(3);
      expect(table.map(p => p.plan)).toEqual(['free', 'pro', 'duo']);
    });
  });

  describe('Sanitização e Validação de Documento (CPF / CNPJ)', () => {
    it('deve sanitizar documento removendo caracteres especiais', () => {
      expect(service.sanitizeCpfCnpj('123.456.789-00')).toBe('12345678900');
      expect(service.sanitizeCpfCnpj('12.345.678/0001-90')).toBe('12345678000190');
    });

    it('deve validar comprimento de CPF (11 dígitos) e CNPJ (14 dígitos)', () => {
      expect(service.isValidCpfCnpj('123.456.789-00')).toBe(true);
      expect(service.isValidCpfCnpj('12.345.678/0001-90')).toBe(true);
      expect(service.isValidCpfCnpj('12345')).toBe(false);
    });
  });

  describe('Criação de Cliente e Assinatura', () => {
    it('Cenário BDD 1: deve criar cliente com CPF sanitizado', async () => {
      const customer = await service.createCustomer({
        name: 'Philipe Efrain',
        email: 'philipe@example.com',
        cpfCnpj: '123.456.789-00'
      });

      expect(customer.id).toBeTruthy();
      expect(customer.cpfCnpj).toBe('12345678900');
    });

    it('deve rejeitar criação de cliente com CPF inválido', async () => {
      await expect(
        service.createCustomer({
          name: 'Teste',
          email: 'teste@example.com',
          cpfCnpj: '123'
        })
      ).rejects.toThrow('CPF ou CNPJ inválido');
    });

    it('Cenário BDD 2: deve criar assinatura para plano Pro Anual via PIX', async () => {
      const sub = await service.createSubscription({
        plan: 'pro',
        cycle: 'YEARLY',
        billingType: 'PIX',
        customerId: 'cus_123456'
      });

      expect(sub.id).toBeTruthy();
      expect(sub.customer).toBe('cus_123456');
      expect(sub.value).toBe(89.90);
      expect(sub.cycle).toBe('YEARLY');
      expect(sub.billingType).toBe('PIX');
      expect(sub.status).toBe('ACTIVE');
    });

    it('deve rejeitar assinatura para plano Free', async () => {
      await expect(
        service.createSubscription({
          plan: 'free',
          cycle: 'MONTHLY',
          billingType: 'PIX',
          customerId: 'cus_123456'
        })
      ).rejects.toThrow('Plano gratuito não requer assinatura');
    });

    it('deve gerar QR Code e payload copia-e-cola para pagamento PIX', async () => {
      const pix = await service.getPixQrCodeForPayment('pay_987654');
      expect(pix.encodedImage).toContain('data:image/png;base64');
      expect(pix.payload).toContain('br.gov.bcb.pix');
      expect(pix.expirationDate).toBeTruthy();
    });
  });

  describe('Processamento e Segurança de Webhooks', () => {
    const samplePayload: AsaasWebhookPayload = {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_123',
        customer: 'cus_123',
        value: 89.90,
        netValue: 88.91,
        status: 'RECEIVED',
        billingType: 'PIX',
        dueDate: '2026-09-08'
      }
    };

    it('Cenário BDD (Segurança): deve rejeitar webhook com token de acesso incorreto', () => {
      const result = service.processWebhookEvent(samplePayload, 'token-errado', 'token-secreto-esperado');
      expect(result.success).toBe(false);
      expect(result.shouldUpdatePlan).toBe(false);
      expect(result.error).toContain('Token de autenticação do webhook inválido');
    });

    it('Cenário BDD: deve aprovar e ativar plano quando evento for PAYMENT_RECEIVED', () => {
      const result = service.processWebhookEvent(samplePayload, 'secret-123', 'secret-123');
      expect(result.success).toBe(true);
      expect(result.shouldUpdatePlan).toBe(true);
      expect(result.newPlanStatus).toBe('active');
    });

    it('Cenário BDD: deve marcar plano como past_due quando evento for PAYMENT_OVERDUE', () => {
      const overduePayload: AsaasWebhookPayload = {
        ...samplePayload,
        event: 'PAYMENT_OVERDUE'
      };
      const result = service.processWebhookEvent(overduePayload);
      expect(result.success).toBe(true);
      expect(result.shouldUpdatePlan).toBe(true);
      expect(result.newPlanStatus).toBe('past_due');
    });

    it('Cenário BDD: deve marcar plano como canceled quando evento for PAYMENT_REFUNDED', () => {
      const refundedPayload: AsaasWebhookPayload = {
        ...samplePayload,
        event: 'PAYMENT_REFUNDED'
      };
      const result = service.processWebhookEvent(refundedPayload);
      expect(result.success).toBe(true);
      expect(result.shouldUpdatePlan).toBe(true);
      expect(result.newPlanStatus).toBe('canceled');
    });
  });
});
