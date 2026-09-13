import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleAsaasWebhook } from './webhook-handler.js';
import { cleanupAllExpiredCycles } from './cleanup.js';
import { sendTelegramFeedback } from './feedback.js';
import type { TelegramFeedbackData } from './feedback.js';
import type { AsaasWebhookPayload } from './types.js';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

/**
 * Endpoint de Webhook do Asaas v3 para Automação de Recorrência e Sincronização de Assinaturas
 * Suporta POST com validação de token (CWE-306), idempotência e atualização atômica de perfil.
 */
export const asaasWebhook = onRequest(
  {
    cors: true,
    maxInstances: 10,
    invoker: 'public'
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        statusCode: 405,
        message: 'Método não permitido. Utilize POST.'
      });
      return;
    }

    try {
      const result = await handleAsaasWebhook(
        req.headers,
        req.body as AsaasWebhookPayload,
        { db }
      );

      res.status(result.statusCode).json(result);
    } catch (err: any) {
      console.error('Erro crítico ao processar webhook Asaas:', err?.message || err);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Erro interno ao processar webhook.'
      });
    }
  }
);

/**
 * Rotina agendada para limpeza automática de dados de ciclos históricos expirados (CARD-072).
 * Executa mensalmente no dia 1 às 03:00 da manhã (fuso de São Paulo), após o encerramento do mês de carência (+1).
 */
export const scheduledCleanupExpiredCycles = onSchedule(
  {
    schedule: '0 3 1 * *',
    timeZone: 'America/Sao_Paulo',
    maxInstances: 1
  },
  async () => {
    console.log('[Cleanup] Iniciando rotina de expurgo de ciclos mensais expirados...');
    const result = await cleanupAllExpiredCycles(db);
    console.log('[Cleanup] Concluído com sucesso:', result);
  }
);

/**
 * Função Callable para envio seguro de feedback, sugestões e alertas de erro via Bot do Telegram (CARD-073).
 * Exige autenticação estrita do usuário e faz envio protegido sem expor chaves no frontend.
 */
export const sendFeedbackTelegram = onCall(
  {
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para enviar feedback ou reportar erro.'
      );
    }

    const data = request.data as TelegramFeedbackData;
    const user = {
      uid: request.auth.uid,
      email: (request.auth.token as any)?.email || null,
      displayName: (request.auth.token as any)?.name || null
    };

    const result = await sendTelegramFeedback(data, user, { db });

    if (!result.success) {
      throw new HttpsError('internal', result.error || 'Erro ao despachar mensagem de feedback.');
    }

    return result;
  }
);

