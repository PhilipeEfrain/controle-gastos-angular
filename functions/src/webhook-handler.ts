import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import { AsaasWebhookPayload, ProcessWebhookResult } from './types.js';

export interface WebhookHandlerDependencies {
  db: Firestore;
  getWebhookSecret?: () => Promise<string | undefined>;
}

/**
 * Recupera o segredo do Webhook do Asaas (via Secret Manager / env ou Firestore)
 */
export async function resolveWebhookSecret(db: Firestore): Promise<string | undefined> {
  if (process.env.ASAAS_WEBHOOK_SECRET) {
    return process.env.ASAAS_WEBHOOK_SECRET;
  }

  try {
    const configSnap = await db.collection('system_config').doc('asaas').get();
    if (configSnap.exists) {
      const data = configSnap.data();
      return data?.webhookSecret;
    }
  } catch (err) {
    console.error('Erro ao buscar webhookSecret em system_config/asaas:', err);
  }

  return undefined;
}

/**
 * Localiza o documento do usuário associado ao pagamento ou assinatura do Asaas
 */
export async function findUserDocByAsaasData(
  db: Firestore,
  payload: AsaasWebhookPayload
): Promise<DocumentReference | null> {
  const externalRef = payload.payment?.externalReference || payload.subscription?.externalReference;
  const subscriptionId = payload.payment?.subscription || payload.subscription?.id;
  const customerId = payload.payment?.customer || payload.subscription?.customer;

  // 1. Tentar localizar pelo externalReference (UID direto)
  if (externalRef && typeof externalRef === 'string') {
    const userDocRef = db.collection('users').doc(externalRef);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      return userDocRef;
    }
  }

  // 2. Tentar localizar pelo asaasSubscriptionId
  if (subscriptionId && typeof subscriptionId === 'string') {
    const querySnap = await db
      .collection('users')
      .where('asaasSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      return querySnap.docs[0].ref;
    }
  }

  // 3. Tentar localizar pelo asaasCustomerId
  if (customerId && typeof customerId === 'string') {
    const querySnap = await db
      .collection('users')
      .where('asaasCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      return querySnap.docs[0].ref;
    }
  }

  return null;
}

/**
 * Calcula a data de expiração da assinatura a partir do vencimento ou D+30
 */
export function calculatePlanExpiration(dueDateStr?: string): string {
  const now = new Date();
  if (dueDateStr) {
    const normalizedStr = dueDateStr.length === 10 ? `${dueDateStr}T12:00:00Z` : dueDateStr;
    const dueDate = new Date(normalizedStr);
    if (!isNaN(dueDate.getTime())) {
      const baseDate = dueDate > now ? dueDate : now;
      baseDate.setUTCDate(baseDate.getUTCDate() + 30);
      return baseDate.toISOString();
    }
  }

  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

/**
 * Calcula o prazo de carência de 3 dias corridos (Grace Period D+3)
 */
export function calculateGracePeriodExpiration(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString();
}

/**
 * Controlador principal do Webhook do Asaas
 */
export async function handleAsaasWebhook(
  headers: Record<string, string | string[] | undefined>,
  payload: AsaasWebhookPayload,
  deps: WebhookHandlerDependencies
): Promise<ProcessWebhookResult> {
  const { db } = deps;

  // 1. Autenticação Obrigatória Fail-Closed (CWE-306)
  const receivedToken = (headers['asaas-access-token'] || headers['Asaas-Access-Token']) as string | undefined;
  const expectedSecret = deps.getWebhookSecret
    ? await deps.getWebhookSecret()
    : await resolveWebhookSecret(db);

  if (!expectedSecret || !receivedToken || receivedToken !== expectedSecret) {
    return {
      success: false,
      statusCode: 401,
      message: 'Token de autenticação do webhook inválido ou ausente.'
    };
  }

  // 2. Validação do Payload
  if (!payload || !payload.event) {
    return {
      success: false,
      statusCode: 400,
      message: 'Payload inválido: evento não especificado.'
    };
  }

  const eventId = payload.id || `${payload.payment?.id || payload.subscription?.id || 'evt'}_${payload.event}`;

  // 3. Idempotência Estrita (Cenário BDD 4)
  const auditDocRef = db.collection('system_events').doc('webhooks').collection('events').doc(eventId);
  const auditSnap = await auditDocRef.get();

  if (auditSnap.exists) {
    return {
      success: true,
      statusCode: 200,
      message: 'Evento já processado anteriormente (idempotência garantida).',
      eventId,
      alreadyProcessed: true
    };
  }

  // 4. Localização do Usuário
  const userDocRef = await findUserDocByAsaasData(db, payload);
  let actionTaken = 'AUDITED_ONLY';
  let targetUserId: string | undefined;

  if (userDocRef) {
    targetUserId = userDocRef.id;
    const userSnap = await userDocRef.get();
    const currentData = userSnap.data() || {};
    const nowIso = new Date().toISOString();

    switch (payload.event) {
      // Cenário BDD 1: Confirmação ou recebimento de pagamento
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        const newExpiration = calculatePlanExpiration(payload.payment?.dueDate);
        const updates: Record<string, any> = {
          planStatus: 'active',
          planExpiresAt: newExpiration,
          gracePeriodExpiresAt: null,
          updatedAt: nowIso
        };

        // Se estava no Free e confirmou pagamento, promove para Pro (ou Duo se aplicável)
        if (!currentData.plan || currentData.plan === 'free') {
          const isDuo = payload.subscription?.description?.toLowerCase().includes('duo') ||
                        payload.payment?.description?.toLowerCase().includes('duo');
          updates.plan = isDuo ? 'duo' : 'pro';
        }

        if (payload.payment?.subscription && !currentData.asaasSubscriptionId) {
          updates.asaasSubscriptionId = payload.payment.subscription;
        }

        await userDocRef.update(updates);
        actionTaken = 'PLAN_ACTIVATED_OR_RENEWED';
        break;
      }

      // Cenário BDD 2: Notificação de atraso / inadimplência
      case 'PAYMENT_OVERDUE': {
        const gracePeriod = calculateGracePeriodExpiration();
        await userDocRef.update({
          planStatus: 'past_due',
          gracePeriodExpiresAt: gracePeriod,
          updatedAt: nowIso
        });
        actionTaken = 'GRACE_PERIOD_STARTED';
        break;
      }

      // Cenário BDD 3: Cancelamento de assinatura
      case 'SUBSCRIPTION_INACTIVATED':
      case 'SUBSCRIPTION_DELETED': {
        await userDocRef.update({
          planStatus: 'canceled',
          plan: 'free',
          updatedAt: nowIso,
          inactivatedAt: nowIso,
          inactivationReason: payload.event
        });
        actionTaken = 'PLAN_CANCELED';
        break;
      }

      // Reembolso ou estorno de pagamento
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        await userDocRef.update({
          planStatus: 'canceled',
          plan: 'free',
          updatedAt: nowIso,
          inactivatedAt: nowIso,
          inactivationReason: payload.event
        });
        actionTaken = 'PAYMENT_REFUNDED_CANCELED';
        break;
      }

      default:
        actionTaken = `EVENT_${payload.event}_RECORDED`;
        break;
    }
  }

  // 5. Registro de Auditoria no Firestore (system_events/webhooks/{eventId})
  await auditDocRef.set({
    eventId,
    event: payload.event,
    receivedAt: new Date().toISOString(),
    actionTaken,
    userId: targetUserId || null,
    paymentId: payload.payment?.id || null,
    subscriptionId: payload.payment?.subscription || payload.subscription?.id || null,
    customerId: payload.payment?.customer || payload.subscription?.customer || null,
    payload
  });

  return {
    success: true,
    statusCode: 200,
    message: 'Webhook processado com sucesso.',
    eventId,
    userId: targetUserId,
    actionTaken
  };
}
