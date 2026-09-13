import { TestBed } from '@angular/core/testing';
import { FeedbackService } from './feedback.service';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let mockFirebaseService: any;
  let mockLoggerService: any;

  beforeEach(() => {
    mockFirebaseService = {
      app: {}
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        FeedbackService,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: LoggerService, useValue: mockLoggerService }
      ]
    });

    service = TestBed.inject(FeedbackService);
  });

  it('deve ser instanciado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  describe('collectTechnicalData', () => {
    it('deve coletar dados do ambiente com rota, resolução e versão', () => {
      const data = service.collectTechnicalData('Erro de teste');

      expect(data.appVersion).toBe('v1.5.0');
      expect(data.erroOriginal).toBe('Erro de teste');
      expect(typeof data.urlAtual).toBe('string');
      expect(typeof data.userAgent).toBe('string');
      expect(typeof data.resolucao).toBe('string');
    });

    it('deve coletar dados sem erro original se omitido', () => {
      const data = service.collectTechnicalData();
      expect(data.erroOriginal).toBeUndefined();
    });
  });

  describe('sendFeedback', () => {
    it('deve invocar a callable function do Firebase com sucesso', async () => {
      const mockCallable = vi.fn().mockResolvedValue({
        data: { success: true, messageId: 12345 }
      });
      service.callableFn = mockCallable as any;

      const payload = {
        tipo: 'sugestao' as const,
        assunto: 'Adicionar dark mode automático',
        mensagem: 'Seria muito bom sincronizar com o sistema operacional.'
      };

      const result = await service.sendFeedback(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(12345);
      expect(mockCallable).toHaveBeenCalledWith(payload);
      expect(mockLoggerService.info).toHaveBeenCalled();
    });

    it('deve capturar erro e lançar mensagem amigável quando a callable falhar', async () => {
      const mockCallable = vi.fn().mockRejectedValue(new Error('Função indisponível'));
      service.callableFn = mockCallable as any;

      const payload = {
        tipo: 'erro' as const,
        assunto: 'Falha no cálculo',
        mensagem: 'O saldo final não recalculou após a exclusão.'
      };

      await expect(service.sendFeedback(payload)).rejects.toThrow('Função indisponível');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });
});
