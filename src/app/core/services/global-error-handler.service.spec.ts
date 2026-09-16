import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { GlobalErrorHandler } from './global-error-handler.service';
import { FeedbackService } from './feedback.service';

describe('GlobalErrorHandler (CARD-074)', () => {
  let handler: GlobalErrorHandler;
  let mockFeedbackService: any;
  let ngZone: NgZone;

  beforeEach(() => {
    mockFeedbackService = {
      collectTechnicalData: vi.fn().mockReturnValue({
        urlAtual: '/dashboard',
        userAgent: 'Mozilla/5.0 TestBrowser',
        resolucao: '1920x1080',
        appVersion: 'v1.5.0'
      }),
      sendFeedback: vi.fn().mockResolvedValue({ success: true, messageId: 12345 })
    };

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: FeedbackService, useValue: mockFeedbackService }
      ]
    });

    handler = TestBed.inject(GlobalErrorHandler);
    ngZone = TestBed.inject(NgZone);

    // Mock simples do runOutsideAngular para executar a callback imediatamente
    vi.spyOn(ngZone, 'runOutsideAngular').mockImplementation((fn: () => any) => fn());
    handler.resetThrottle();
    // Ativa para os testes de formatação/sanitização
    handler.enableAutoDispatchToTelegram = true;
  });

  it('deve registrar erro no console e NÃO enviar ao Telegram quando desativado por padrão', async () => {
    handler.enableAutoDispatchToTelegram = false;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Erro de console comum');

    handler.handleError(error);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith('[GlobalErrorHandler Intercepted]:', error);
    expect(mockFeedbackService.sendFeedback).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('Cenário BDD 1: quando habilitado explicitamente, deve despachar para o Telegram com severidade crítica', async () => {
    const error = new TypeError('Cannot read properties of undefined (reading "calcularTotal")');
    error.stack = 'TypeError: Cannot read properties...\n    at DashboardComponent.ngOnInit';

    handler.handleError(error);

    // Aguarda execução da promise assíncrona
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'erro',
        gravidade: 'critica',
        assunto: expect.stringContaining('TypeError'),
        mensagem: expect.stringContaining('Cannot read properties of undefined'),
        dadosTecnicos: expect.objectContaining({ urlAtual: '/dashboard' })
      })
    );
  });

  it('Cenário BDD: deve interceptar HttpErrorResponse formatando código de status e rota', async () => {
    const httpError = new HttpErrorResponse({
      error: 'Falha de comunicação',
      status: 503,
      statusText: 'Service Unavailable',
      url: 'https://api.quinzena.com.br/v1/sync'
    });

    handler.handleError(httpError);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'erro',
        assunto: expect.stringContaining('HttpError_503'),
        mensagem: expect.stringContaining('https://api.quinzena.com.br/v1/sync')
      })
    );
  });

  it('Cenário BDD 2: deve aplicar throttle e não reenviar o mesmo erro duas vezes na mesma janela', async () => {
    const error = new Error('Erro recorrente de rendering');

    // 1º disparo: deve enviar
    handler.handleError(error);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledTimes(1);

    // 2º disparo imediato: deve ser suprimido pelo throttle
    handler.handleError(error);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledTimes(1);
  });

  it('Cenário BDD: deve sanitizar tokens Bearer e senhas nas mensagens de erro', async () => {
    const sensitiveError = new Error('Request falhou com Bearer secret_token_abc123 e password="minhaSenha123"');

    handler.handleError(sensitiveError);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        mensagem: expect.stringContaining('Bearer [REDACTED]')
      })
    );
    expect(mockFeedbackService.sendFeedback).not.toHaveBeenCalledWith(
      expect.objectContaining({
        mensagem: expect.stringContaining('secret_token_abc123')
      })
    );
  });

  it('Cenário BDD 3: deve tratar com resiliência sem crashar caso o envio falhe', async () => {
    mockFeedbackService.sendFeedback.mockRejectedValueOnce(new Error('Network offline'));

    // Não deve lançar exceção não capturada
    expect(() => {
      handler.handleError(new Error('Falha aleatória'));
    }).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockFeedbackService.sendFeedback).toHaveBeenCalled();
  });
});
