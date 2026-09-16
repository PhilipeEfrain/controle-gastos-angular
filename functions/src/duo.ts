import type { Firestore } from 'firebase-admin/firestore';

export interface AcceptDuoInviteRequest {
  inviteCode: string;
  partnerName?: string;
  partnerEmail?: string;
}

export interface AcceptDuoInviteResponse {
  success: boolean;
  groupId: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  message?: string;
}

export interface DuoDependencies {
  db: Firestore;
}

/**
 * Processa o aceite de convite de pareamento do Plano Duo no backend com privilégios Admin (CARD-087).
 * Ativa o grupo e atualiza o perfil do parceiro para plano Duo com segurança.
 */
export async function acceptDuoInviteBackend(
  payload: AcceptDuoInviteRequest,
  callerUid: string,
  deps: DuoDependencies
): Promise<AcceptDuoInviteResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const code = (payload.inviteCode || '').trim().toUpperCase();
  if (!code || code.length < 4) {
    throw new Error('Código de convite inválido.');
  }

  const { db } = deps;

  // 1. Localizar grupo pendente pelo código de convite
  const groupsRef = db.collection('duo_groups');
  const snap = await groupsRef
    .where('inviteCode', '==', code)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error('Código de convite não encontrado, expirado ou já utilizado.');
  }

  const groupDoc = snap.docs[0];
  const groupData = groupDoc.data() || {};
  const ownerId = groupData.ownerId;

  if (ownerId === callerUid) {
    throw new Error('Você não pode se conectar ao seu próprio convite.');
  }

  if (groupData.status === 'active' && groupData.partnerId && groupData.partnerId !== callerUid) {
    throw new Error('Este convite já foi utilizado por outro parceiro.');
  }

  const nowIso = new Date().toISOString();

  // 2. Atualizar o documento do grupo Duo para status 'active'
  await groupDoc.ref.update({
    partnerId: callerUid,
    partnerEmail: payload.partnerEmail || null,
    partnerName: payload.partnerName || 'Parceiro(a)',
    status: 'active',
    updatedAt: nowIso
  });

  // 3. Atualizar perfil do parceiro para plano 'duo' e vincular duoPartnerId (via Admin SDK)
  const partnerUserRef = db.collection('users').doc(callerUid);
  await partnerUserRef.set({
    plan: 'duo',
    planStatus: 'active',
    duoPartnerId: ownerId,
    duoGroupId: groupDoc.id,
    updatedAt: nowIso
  }, { merge: true });

  // 4. Vincular duoPartnerId e duoGroupId no perfil do titular (owner)
  const ownerUserRef = db.collection('users').doc(ownerId);
  await ownerUserRef.set({
    duoPartnerId: callerUid,
    duoGroupId: groupDoc.id,
    updatedAt: nowIso
  }, { merge: true });

  return {
    success: true,
    groupId: groupDoc.id,
    ownerId,
    ownerName: groupData.ownerName || undefined,
    ownerEmail: groupData.ownerEmail || undefined,
    message: 'Pareamento Duo concluído com sucesso!'
  };
}

export interface DisconnectDuoPartnerRequest {
  groupId: string;
}

export interface DisconnectDuoPartnerResponse {
  success: boolean;
  message: string;
  isOwner: boolean;
}

/**
 * Gera um código de convite aleatório padronizado (ex: DUO-7842)
 */
export function generateDuoInviteCode(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `DUO-${randomDigits}`;
}

/**
 * Limpa vínculos de grupos Duo antigos onde o usuário figurava como parceiro dependente.
 * Usado quando o usuário contrata seu próprio plano Duo para torná-lo dono com autonomia.
 */
export async function cleanupOldDuoPartnerLinks(userId: string, db: Firestore): Promise<void> {
  if (!userId) return;
  const groupsRef = db.collection('duo_groups');
  const snap = await groupsRef.where('partnerId', '==', userId).get();
  const nowIso = new Date().toISOString();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const newCode = generateDuoInviteCode();
    await docSnap.ref.update({
      partnerId: null,
      partnerEmail: null,
      partnerName: null,
      status: 'pending',
      inviteCode: newCode,
      updatedAt: nowIso
    });
    if (data.ownerId) {
      await db.collection('users').doc(data.ownerId).set({
        duoPartnerId: null,
        updatedAt: nowIso
      }, { merge: true });
    }
  }
}

/**
 * Desconecta parceiro do grupo Duo com privilégios Admin.
 * Pode ser executado tanto pelo Titular (Dono) quanto pelo Parceiro Convidado.
 */
export async function disconnectDuoPartnerBackend(
  payload: DisconnectDuoPartnerRequest,
  callerUid: string,
  deps: DuoDependencies
): Promise<DisconnectDuoPartnerResponse> {
  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado. Faça login para continuar.');
  }

  const groupId = (payload?.groupId || '').trim();
  if (!groupId) {
    throw new Error('Identificador do grupo Duo não fornecido.');
  }

  const { db } = deps;
  const groupRef = db.collection('duo_groups').doc(groupId);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new Error('Grupo Duo não encontrado.');
  }

  const groupData = groupSnap.data() || {};
  const ownerId = groupData.ownerId;
  const currentPartnerId = groupData.partnerId;

  if (callerUid !== ownerId && callerUid !== currentPartnerId) {
    throw new Error('Você não possui permissão para gerenciar este grupo Duo.');
  }

  const nowIso = new Date().toISOString();
  const newInviteCode = generateDuoInviteCode();

  // 1. Atualiza o grupo Duo para status 'pending' e remove dados do parceiro
  await groupRef.update({
    partnerId: null,
    partnerEmail: null,
    partnerName: null,
    status: 'pending',
    inviteCode: newInviteCode,
    updatedAt: nowIso
  });

  // 2. Limpa duoPartnerId no perfil do titular (mantém duoGroupId se existir documento)
  if (ownerId) {
    const ownerUserRef = db.collection('users').doc(ownerId);
    const ownerSnap = await ownerUserRef.get();
    if (ownerSnap.exists) {
      await ownerUserRef.update({
        duoPartnerId: null,
        updatedAt: nowIso
      });
    }
  }

  // 3. Atualiza perfil do parceiro desvinculado (se existir documento)
  if (currentPartnerId) {
    const partnerUserRef = db.collection('users').doc(currentPartnerId);
    const partnerUserSnap = await partnerUserRef.get();
    if (partnerUserSnap.exists) {
      const partnerUserData = partnerUserSnap.data() || {};

      // Se o parceiro não possui assinatura própria ativa no Asaas, retorna para 'free'
      const hasOwnSubscription = !!partnerUserData.asaasSubscriptionId && partnerUserData.planStatus === 'active';

      const partnerUpdates: Record<string, any> = {
        duoPartnerId: null,
        duoGroupId: null,
        updatedAt: nowIso
      };

      if (!hasOwnSubscription) {
        partnerUpdates.plan = 'free';
        partnerUpdates.planStatus = 'active';
      }

      await partnerUserRef.update(partnerUpdates);
    }
  }

  const isOwner = callerUid === ownerId;
  return {
    success: true,
    message: isOwner ? 'Parceiro desvinculado com sucesso.' : 'Você saiu do grupo Duo com sucesso.',
    isOwner
  };
}
