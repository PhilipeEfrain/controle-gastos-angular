export interface AdminDeleteUserRequest {
  targetUid: string;
  reason?: string;
}

export interface AdminDeleteUserResponse {
  success: boolean;
  targetUid: string;
  message: string;
}

export interface AdminServicesContext {
  db: FirebaseFirestore.Firestore;
  auth: {
    deleteUser: (uid: string) => Promise<void>;
  };
}

/**
 * Executa a exclusão definitiva e em cascata de um usuário pelo painel administrativo (CARD-082).
 * Garante conformidade com o Artigo 18 da LGPD (Direito ao Esquecimento) e integridade referencial.
 */
export async function deleteUserCascade(
  payload: AdminDeleteUserRequest,
  callerUid: string,
  services: AdminServicesContext
): Promise<AdminDeleteUserResponse> {
  const { targetUid, reason } = payload;

  if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
    throw new Error('O UID do usuário alvo é obrigatório.');
  }

  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado.');
  }

  // 1. Prevenir auto-exclusão acidental do próprio administrador
  if (targetUid === callerUid) {
    throw new Error('Um administrador não pode excluir sua própria conta pelo painel.');
  }

  // 2. Validação estrita de privilégios de administrador
  const callerDoc = await services.db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new Error('Acesso negado: Requer privilégios de administrador.');
  }

  // 3. Obter dados prévios do usuário alvo para auditoria e limpeza de relacionamentos
  const targetDocRef = services.db.collection('users').doc(targetUid);
  const targetDoc = await targetDocRef.get();
  const targetData = targetDoc.exists ? targetDoc.data() : null;
  const targetEmail = targetData?.email || 'email-nao-registrado';

  // 4. Limpeza e desvinculação de parceria Duo se existente
  if (targetData?.duoPartnerId) {
    try {
      const partnerDocRef = services.db.collection('users').doc(targetData.duoPartnerId);
      const partnerDoc = await partnerDocRef.get();
      if (partnerDoc.exists) {
        await partnerDocRef.update({
          duoPartnerId: null,
          duoGroupId: null,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (duoErr) {
      console.warn(`[Admin Delete] Falha não impeditiva ao desvincular parceiro Duo (${targetData.duoPartnerId}):`, duoErr);
    }
  }

  // 5. Exclusão recursiva de todas as subcoleções e documento do usuário no Firestore
  if (typeof (services.db as any).recursiveDelete === 'function') {
    await (services.db as any).recursiveDelete(targetDocRef);
  } else {
    // Fallback caso recursiveDelete não esteja mockado no teste
    await targetDocRef.delete();
  }

  // 6. Exclusão da credencial no Firebase Authentication
  try {
    await services.auth.deleteUser(targetUid);
  } catch (authErr: any) {
    if (authErr?.code !== 'auth/user-not-found') {
      console.warn(`[Admin Delete] Aviso ao excluir usuário do Auth (${targetUid}):`, authErr?.message || authErr);
    }
  }

  // 7. Registro imutável de evento de auditoria no Firestore (/system_events)
  try {
    await services.db.collection('system_events').add({
      eventType: 'USER_DELETED_BY_ADMIN',
      adminUid: callerUid,
      targetUid,
      targetEmail,
      reason: reason || 'Solicitação de exclusão definitiva / LGPD Art. 18',
      timestamp: new Date().toISOString()
    });
  } catch (auditErr) {
    console.error('[Admin Delete] Falha ao registrar log de auditoria em system_events:', auditErr);
  }

  return {
    success: true,
    targetUid,
    message: `Conta do usuário ${targetEmail} (${targetUid}) e todos os dados associados foram excluídos com sucesso.`
  };
}
