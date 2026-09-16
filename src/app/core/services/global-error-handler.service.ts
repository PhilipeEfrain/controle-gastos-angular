import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FeedbackService } from './feedback.service';
import { FeedbackPayload } from '../models/feedback.model';
import { environment } from '../../../environments/environment';

export interface ErrorReportThrottleEntry {
  timestamp: number;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {
  private readonly THROTTLE_WINDOW_MS = 60000; // 1 minuto de intervalo por assinatura de erro
  private readonly MAX_SESSION_ERRORS = 10; // Teto de segurança anti-spam por sessão (Denial of Wallet)
  
  private errorHistory = new Map<string, number>();
  private totalErrorsSentInSession = 0;

  /**
   * Flag de controle para envio automático ao Telegram.
   * Desativado por padrão (false): erros de console NÃO disparam mensagens para o bot.
   * O bot deve ser acionado exclusivamente quando um usuário envia um feedback manual.
   */
  enableAutoDispatchToTelegram = false;

  constructor(
    private readonly injector: Injector,
    private readonly ngZone: NgZone
  ) {}

  handleError(error: any): void {
    // 1. Sempre registra o erro no console para visibilidade local imediata
    console.error('[GlobalErrorHandler Intercepted]:', error);

    // 2. Se o envio automático de erros de console estiver desativado, encerra sem notificar o Telegram
    if (!this.enableAutoDispatchToTelegram) {
      return;
    }

    // 3. Extrai dados normalizados e seguros do erro
    const { name, message, stack } = this.extractErrorInfo(error);

    // 3. Checagem de Throttle e Limite de Sessão
    const errorSignature = `${name}:${message.substring(0, 120)}`;
    const now = Date.now();
    const lastSent = this.errorHistory.get(errorSignature);

    if (lastSent && now - lastSent < this.THROTTLE_WINDOW_MS) {
      console.warn(`[GlobalErrorHandler] Erro suprimido por throttle antispam (${Math.round((this.THROTTLE_WINDOW_MS - (now - lastSent)) / 1000)}s restantes):`, errorSignature);
      return;
    }

    if (this.totalErrorsSentInSession >= this.MAX_SESSION_ERRORS) {
      console.warn('[GlobalErrorHandler] Teto de segurança de erros por sessão atingido. Envio suspenso para evitar spam.');
      return;
    }

    // Atualiza histórico de rate-limit
    this.errorHistory.set(errorSignature, now);
    this.totalErrorsSentInSession++;

    // 4. Despacha o erro de forma assíncrona fora da Zone do Angular (não bloqueia UI)
    this.ngZone.runOutsideAngular(async () => {
      try {
        const feedbackService = this.injector.get(FeedbackService, null);
        if (!feedbackService) {
          return;
        }

        const technicalData = feedbackService.collectTechnicalData(message);
        const payload: FeedbackPayload = {
          tipo: 'erro',
          assunto: `[Crash Runtime] ${name.substring(0, 40)}`,
          mensagem: `🚨 **Erro de Runtime Não Tratado Interceptado**:\n\n**Tipo:** ${name}\n**Mensagem:** ${message}\n\n**Ambiente:** ${environment.production ? 'Produção' : 'Desenvolvimento'}\n**Rota:** ${technicalData.urlAtual || 'Desconhecida'}\n\n**Stack Trace:**\n\`\`\`\n${stack.substring(0, 800)}\n\`\`\``,
          gravidade: 'critica',
          dadosTecnicos: technicalData
        };

        await feedbackService.sendFeedback(payload);
        console.info('[GlobalErrorHandler] Notificação de crash enviada ao Telegram com sucesso.');
      } catch (dispatchErr) {
        // Falha segura: nunca propaga erro do handler para evitar loops recursivos de crashes
        console.warn('[GlobalErrorHandler] Falha silenciosa ao despachar erro para o Telegram:', dispatchErr);
      }
    });
  }

  /**
   * Extrai e sanitiza informações essenciais do erro
   */
  private extractErrorInfo(error: any): { name: string; message: string; stack: string } {
    let name = 'RuntimeError';
    let message = 'Ocorreu um erro desconhecido.';
    let stack = '';

    if (!error) {
      return { name, message, stack };
    }

    if (error instanceof HttpErrorResponse) {
      name = `HttpError_${error.status || 'Unknown'}`;
      message = `Falha na requisição para ${error.url || 'URL desconhecida'}: ${error.statusText || error.message}`;
      stack = typeof error.error === 'string' ? error.error : JSON.stringify(error.error || {});
    } else if (error instanceof Error) {
      name = error.name || 'Error';
      message = error.message || 'Sem mensagem';
      stack = error.stack || '';
    } else if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object') {
      name = error.name || error.constructor?.name || 'ObjectError';
      message = error.message || JSON.stringify(error);
      stack = error.stack || '';
    }

    // Sanitização simples para remover credenciais acidentais
    message = this.sanitizeSensitiveText(message);
    stack = this.sanitizeSensitiveText(stack);

    return { name, message, stack };
  }

  /**
   * Remove tokens e credenciais confidenciais de mensagens e stacks
   */
  private sanitizeSensitiveText(text: string): string {
    if (!text) return '';
    return text
      .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
      .replace(/key=[A-Za-z0-9\-_]+/gi, 'key=[REDACTED]')
      .replace(/password\s*[:=]\s*["']?[^"'&\s]+/gi, 'password=[REDACTED]')
      .replace(/apiKey\s*[:=]\s*["']?[^"'&\s]+/gi, 'apiKey=[REDACTED]');
  }

  /**
   * Métodos utilitários expostos para testes unitários
   */
  resetThrottle(): void {
    this.errorHistory.clear();
    this.totalErrorsSentInSession = 0;
  }
}
