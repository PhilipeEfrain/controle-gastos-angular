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
