import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackModalComponent } from './feedback-modal.component';
import { FeedbackService } from '../../../core/services/feedback.service';
import { NotificationService } from '../../../core/services/notification.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('FeedbackModalComponent', () => {
  let component: FeedbackModalComponent;
  let fixture: ComponentFixture<FeedbackModalComponent>;
  let mockFeedbackService: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockFeedbackService = {
      collectTechnicalData: vi.fn().mockReturnValue({
        urlAtual: '/dashboard',
        userAgent: 'TestBrowser',
        resolucao: '1920x1080',
        appVersion: 'v1.5.0',
        erroOriginal: undefined
      }),
      sendFeedback: vi.fn().mockResolvedValue({ success: true, messageId: 101 })
    };

    mockNotificationService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [FeedbackModalComponent],
      providers: [
        { provide: FeedbackService, useValue: mockFeedbackService },
        { provide: NotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve instanciar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('não deve exibir o diálogo quando isOpen for false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.feedback-dialog');
    expect(dialog).toBeNull();
  });

  it('deve exibir o diálogo quando isOpen for true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.feedback-dialog');
    expect(dialog).toBeTruthy();
  });

  it('deve carregar dados de contexto quando fornecidos', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('context', {
      tipo: 'erro',
      assunto: 'Falha no carregamento',
      errorMessage: 'Timeout error',
      gravidade: 'alta'
    });
    fixture.detectChanges();

    expect(component.tipo()).toBe('erro');
    expect(component.assunto()).toBe('Falha no carregamento');
    expect(component.gravidade()).toBe('alta');
    expect(mockFeedbackService.collectTechnicalData).toHaveBeenCalledWith('Timeout error');
  });

  it('deve alternar categoria ao clicar nos pills', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    component.setTipo('elogio');
    expect(component.tipo()).toBe('elogio');

    component.setTipo('erro');
    expect(component.tipo()).toBe('erro');
  });

  it('deve alternar gravidade', () => {
    fixture.componentRef.setInput('isOpen', true);
    component.setTipo('erro');
    fixture.detectChanges();

    component.setGravidade('alta');
    expect(component.gravidade()).toBe('alta');

    component.setGravidade('baixa');
    expect(component.gravidade()).toBe('baixa');
  });

  it('deve validar o formulário (desabilitado se inválido, habilitado se preenchido)', () => {
    component.assunto.set('Oi'); // < 3
    component.mensagem.set('Teste'); // >= 5
    expect(component.isFormValid()).toBe(false);

    component.assunto.set('Novo Recurso'); // >= 3
    component.mensagem.set('1234'); // < 5
    expect(component.isFormValid()).toBe(false);

    component.assunto.set('Novo Recurso');
    component.mensagem.set('Gostaria de solicitar suporte a atalhos.');
    expect(component.isFormValid()).toBe(true);
  });

  it('deve alternar a visibilidade do diagnóstico técnico', () => {
    expect(component.showDiagnostics()).toBe(false);
    component.toggleDiagnostics();
    expect(component.showDiagnostics()).toBe(true);
    component.toggleDiagnostics();
    expect(component.showDiagnostics()).toBe(false);
  });

  it('deve emitir close ao chamar onClose', () => {
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve fechar ao pressionar a tecla Escape', () => {
    fixture.componentRef.setInput('isOpen', true);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    component.handleEscape();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve fechar ao clicar no backdrop', () => {
    fixture.componentRef.setInput('isOpen', true);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    const mockEvent = {
      target: { classList: { contains: (cls: string) => cls === 'feedback-backdrop' } }
    } as any;

    component.onBackdropClick(mockEvent);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve submeter feedback com sucesso, notificar e emitir close', async () => {
    fixture.componentRef.setInput('isOpen', true);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    component.tipo.set('sugestao');
    component.assunto.set('Adicionar filtros');
    component.mensagem.set('Gostaria de poder filtrar por categoria no painel.');

    await component.onSubmit();

    expect(mockFeedbackService.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'sugestao',
        assunto: 'Adicionar filtros',
        mensagem: 'Gostaria de poder filtrar por categoria no painel.'
      })
    );
    expect(mockNotificationService.success).toHaveBeenCalledWith(
      expect.stringContaining('Obrigado! Seu feedback foi enviado')
    );
    expect(closeSpy).toHaveBeenCalled();
  });

  it('deve exibir erro e notificar quando feedbackService falhar', async () => {
    mockFeedbackService.sendFeedback.mockRejectedValue(new Error('Erro de conexão com o Telegram'));
    fixture.componentRef.setInput('isOpen', true);

    component.tipo.set('erro');
    component.assunto.set('Erro ao sincronizar');
    component.mensagem.set('O aplicativo travou ao trocar de ciclo.');

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Erro de conexão com o Telegram');
    expect(mockNotificationService.error).toHaveBeenCalledWith('Erro de conexão com o Telegram');
    expect(component.isSubmitting()).toBe(false);
  });
});
