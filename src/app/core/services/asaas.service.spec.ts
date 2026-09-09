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
    it('Cenário BDD: deve retornar os preços mensais oficiais dos planos Pro e Duo', () => {
      expect(service.getPlanPrice('free')).toBe(0);
      expect(service.getPlanPrice('pro')).toBe(9.90);
      expect(service.getPlanPrice('pro', 'MONTHLY')).toBe(9.90);
      expect(service.getPlanPrice('duo')).toBe(19.90);
      expect(service.getPlanPrice('duo', 'MONTHLY')).toBe(19.90);
    });

    it('Cenário BDD: deve fornecer lista completa de 3 planos com recursos', () => {
      const table = service.getPricingTable();
      expect(table.length).toBe(3);
      expect(table.map(p => p.plan)).toEqual(['free', 'pro', 'duo']);
    });

    it('Cenário BDD: deve retornar rota proxy em localhost e URL oficial em produção', () => {
      const sandboxUrl = service.getBaseUrl('sandbox');
      expect(sandboxUrl).toBeTruthy();
      const prodUrl = service.getBaseUrl('production');
      expect(prodUrl).toBeTruthy();
    });
  });


  describe('Sanitização e Validação de Documento (CPF Exclusivo)', () => {
    it('deve sanitizar documento removendo caracteres especiais', () => {
      expect(service.sanitizeCpfCnpj('529.982.247-25')).toBe('52998224725');
      expect(service.sanitizeCpfCnpj('11.222.333/0001-81')).toBe('11222333000181');
    });

    it('deve validar matematicamente CPF com módulo 11 oficial e REJEITAR CNPJ', () => {
      // CPFs válidos
      expect(service.isValidCpf('529.982.247-25')).toBe(true);
      expect(service.isValidCpf('52998224725')).toBe(true);
      expect(service.isValidCpfCnpj('529.982.247-25')).toBe(true);

      // CNPJs devem ser estritamente rejeitados
      expect(service.isValidCpf('11.222.333/0001-81')).toBe(false);
      expect(service.isValidCpf('11222333000181')).toBe(false);
      expect(service.isValidCpfCnpj('11.222.333/0001-81')).toBe(false);

      // Inválidos
      expect(service.isValidCpf('12345')).toBe(false);
      expect(service.isValidCpf('111.111.111-11')).toBe(false); // dígitos repetidos
      expect(service.isValidCpf('123.456.789-00')).toBe(false); // DV incorreto
      expect(service.isValidCpf('')).toBe(false);
      expect(service.isValidCpf(null as any)).toBe(false);
    });
  });

  describe('Criação de Cliente e Assinatura', () => {
    it('Cenário BDD 1: deve criar cliente com CPF sanitizado', async () => {
      const customer = await service.createCustomer({
        name: 'Philipe Efrain',
        email: 'philipe@example.com',
        cpfCnpj: '529.982.247-25'
      });

      expect(customer.id).toBeTruthy();
      expect(customer.cpfCnpj).toBe('52998224725');
    });

    it('deve rejeitar criação de cliente com CNPJ (apenas pessoa física permitida)', async () => {
      await expect(
        service.createCustomer({
          name: 'Empresa Teste',
          email: 'empresa@example.com',
          cpfCnpj: '11.222.333/0001-81'
        })
      ).rejects.toThrow('Cadastro permitido exclusivamente para pessoa física (CPF)');
    });

    it('deve rejeitar criação de cliente com CPF inválido', async () => {
      await expect(
        service.createCustomer({
          name: 'Teste',
          email: 'teste@example.com',
          cpfCnpj: '111.111.111-11'
        })
      ).rejects.toThrow('CPF inválido');
    });

    it('Cenário BDD 2: deve criar assinatura para plano Pro via PIX', async () => {
      const sub = await service.createSubscription({
        plan: 'pro',
        cycle: 'MONTHLY',
        billingType: 'PIX',
        customerId: 'cus_123456'
      });

      expect(sub.id).toBeTruthy();
      expect(sub.customer).toBe('cus_123456');
      expect(sub.value).toBe(9.90);
      expect(sub.cycle).toBe('MONTHLY');
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
