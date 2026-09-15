import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleAsaasWebhook } from './webhook-handler.js';
import { cleanupAllExpiredCycles } from './cleanup.js';
import { sendTelegramFeedback } from './feedback.js';
import { deleteUserCascade, testAsaasConnectionBackend } from './admin.js';
import { createPixOrderBackend, createCreditCardOrderBackend } from './payment.js';
import type { CreatePixOrderRequest, CreateCreditCardOrderRequest } from './payment.js';
import type { AdminDeleteUserRequest, AdminTestAsaasRequest } from './admin.js';
import type { TelegramFeedbackData } from './feedback.js';
import type { AsaasWebhookPayload } from './types.js';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

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

/**
 * Função Callable para exclusão segura e em cascata de usuários pelo painel administrativo (CARD-082).
 * Exige perfil de administrador e realiza expurgo de dados em conformidade com a LGPD (Art. 18).
 */
export const adminDeleteUserAccount = onCall(
  {
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para realizar operações administrativas.'
      );
    }

    const data = request.data as AdminDeleteUserRequest;
    try {
      const result = await deleteUserCascade(data, request.auth.uid, { db, auth });
      return result;
    } catch (err: any) {
      console.error('[adminDeleteUserAccount] Erro ao excluir conta de usuário:', err?.message || err);
      const msg = err?.message || '';
      if (msg.includes('Acesso negado')) {
        throw new HttpsError('permission-denied', msg);
      }
      if (msg.includes('não pode excluir sua própria conta')) {
        throw new HttpsError('failed-precondition', msg);
      }
      if (msg.includes('obrigatório')) {
        throw new HttpsError('invalid-argument', msg);
      }
      throw new HttpsError('internal', msg || 'Falha interna ao processar exclusão de usuário.');
    }
  }
);

/**
 * Função Callable para teste seguro de conectividade com a API Asaas v3 via backend (sem CORS).
 * Exige perfil de administrador e valida a chave no endpoint oficial /v3/finance/balance.
 */
export const adminTestAsaasConnection = onCall(
  {
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para testar credenciais administrativas.'
      );
    }

    const data = request.data as AdminTestAsaasRequest;
    try {
      const result = await testAsaasConnectionBackend(data, request.auth.uid, { db });
      return result;
    } catch (err: any) {
      console.error('[adminTestAsaasConnection] Erro ao testar conexão Asaas:', err?.message || err);
      const msg = err?.message || '';
      if (msg.includes('Acesso negado')) {
        throw new HttpsError('permission-denied', msg);
      }
      if (msg.includes('obrigatória') || msg.includes('curta') || msg.includes('vazia')) {
        throw new HttpsError('invalid-argument', msg);
      }
      throw new HttpsError('internal', msg || 'Falha interna ao testar conexão com o Asaas.');
    }
  }
);

/**
 * Função Callable para criação segura de assinatura e geração de QR Code PIX via backend (sem CORS).
 * Autenticado para qualquer usuário logado que queira assinar um plano Pro ou Duo.
 */
export const createPixSubscriptionOrder = onCall(
  {
    cors: true,
    maxInstances: 20
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para gerar pagamento PIX.'
      );
    }

    try {
      const data = request.data as CreatePixOrderRequest;
      const result = await createPixOrderBackend(data, request.auth.uid, { db });
      return result;
    } catch (err: any) {
      console.error('[createPixSubscriptionOrder] Erro ao gerar PIX:', err?.message || err);
      const msg = err?.message || 'Falha ao processar pagamento PIX no gateway Asaas.';
      if (msg.includes('inválido') || msg.includes('obrigatório')) {
        throw new HttpsError('invalid-argument', msg);
      }
      throw new HttpsError('internal', msg);
    }
  }
);

/**
 * Função Callable para criação segura de assinatura com Cartão de Crédito via backend (sem CORS).
 * Autenticado para qualquer usuário logado que queira assinar um plano Pro ou Duo.
 */
export const createCreditCardSubscriptionOrder = onCall(
  {
    cors: true,
    maxInstances: 20
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para realizar pagamento com cartão.'
      );
    }

    try {
      const data = request.data as CreateCreditCardOrderRequest;
      const result = await createCreditCardOrderBackend(data, request.auth.uid, { db });
      return result;
    } catch (err: any) {
      console.error('[createCreditCardSubscriptionOrder] Erro ao processar cartão:', err?.message || err);
      const msg = err?.message || 'Falha ao processar pagamento com cartão no gateway Asaas.';
      if (msg.includes('inválido') || msg.includes('obrigatório')) {
        throw new HttpsError('invalid-argument', msg);
      }
      throw new HttpsError('internal', msg);
    }
  }
);




