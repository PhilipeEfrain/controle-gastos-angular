import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleAsaasWebhook } from './webhook-handler.js';
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
    maxInstances: 10
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
