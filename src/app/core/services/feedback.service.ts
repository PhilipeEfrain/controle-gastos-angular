import { Injectable, inject } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';
import { FeedbackPayload, FeedbackResponse, FeedbackTechnicalData } from '../models/feedback.model';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly logger = inject(LoggerService);

  /**
   * Coleta passiva e transparente dos metadados de ambiente do cliente
   */
  collectTechnicalData(errorMessage?: string): FeedbackTechnicalData {
    let urlAtual = '';
    let userAgent = '';
    let resolucao = '';

    if (typeof window !== 'undefined') {
      urlAtual = (window.location.pathname || '') + (window.location.search || '');
      resolucao = `${window.innerWidth || 0}x${window.innerHeight || 0}`;
    }

    if (typeof navigator !== 'undefined') {
      userAgent = navigator.userAgent || '';
    }

    return {
      urlAtual,
      userAgent,
      resolucao,
      appVersion: 'v1.5.0',
      erroOriginal: errorMessage ? errorMessage.trim() : undefined
    };
  }

  callableFn: ((payload: FeedbackPayload) => Promise<{ data: FeedbackResponse }>) | null = null;

  /**
   * Despacha o feedback para a Cloud Function sendFeedbackTelegram
   */
  async sendFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
    try {
      const callable = this.callableFn || httpsCallable<FeedbackPayload, FeedbackResponse>(
        getFunctions(this.firebaseService.app),
        'sendFeedbackTelegram'
      );

      const result = await callable(payload);
      this.logger.info('Feedback enviado com sucesso via Telegram:', result.data);
      return result.data;
    } catch (err: any) {
      this.logger.error('Erro ao enviar feedback para o Telegram:', err);
      const errorMsg =
        err?.message || err?.details || 'Não foi possível enviar o feedback no momento. Tente novamente mais tarde.';
      throw new Error(errorMsg);
    }
  }
}
