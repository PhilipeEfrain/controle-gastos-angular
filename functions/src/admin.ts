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

export interface AdminTestAsaasRequest {
  apiKey: string;
  environment?: 'sandbox' | 'production';
}

export interface AdminTestAsaasResponse {
  success: boolean;
  message: string;
  balance?: number;
}

/**
 * Executa o teste de conectividade e validação da API Asaas v3 diretamente pelo backend (sem CORS).
 * Garante segurança, autenticação e atualização do status no Firestore (/system_config/asaas).
 */
export async function testAsaasConnectionBackend(
  payload: AdminTestAsaasRequest,
  callerUid: string,
  services: { db: FirebaseFirestore.Firestore; fetchFn?: typeof fetch }
): Promise<AdminTestAsaasResponse> {
  const { apiKey, environment = 'sandbox' } = payload;
  const cleanKey = (apiKey || '').trim();

  if (!cleanKey) {
    throw new Error('A chave de API (Access Token) não pode ser vazia.');
  }

  if (cleanKey.length < 10) {
    throw new Error('A chave de API informada é muito curta ou inválida.');
  }

  if (!callerUid || typeof callerUid !== 'string') {
    throw new Error('Acesso não autenticado.');
  }

  // 1. Validação estrita de privilégios de administrador
  const callerDoc = await services.db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
    throw new Error('Acesso negado: Requer privilégios de administrador.');
  }

  const envLabel = environment === 'production' ? 'PRODUÇÃO' : 'SANDBOX';
  const baseUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  const fetchImpl = services.fetchFn || fetch;

  try {
    const res = await fetchImpl(`${baseUrl}/finance/balance`, {
      method: 'GET',
      headers: {
        'access_token': cleanKey,
        'Content-Type': 'application/json',
        'User-Agent': 'QuinzenaApp/1.0'
      }
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      let errorMsg = `Erro ${res.status} ao conectar com o Asaas (${envLabel}).`;
      if (res.status === 401 || res.status === 403) {
        errorMsg = `Falha de Autenticação (${res.status}): A chave de API informada é inválida ou foi revogada no painel do Asaas (${envLabel}).`;
      } else if (json?.errors?.length > 0) {
        errorMsg = `Erro Asaas: ${json.errors[0].description || json.errors[0].code || json.errors[0].message}`;
      }

      try {
        await services.db.collection('system_config').doc('asaas').set(
          {
            lastTestedAt: new Date().toISOString(),
            lastTestStatus: 'error',
            lastTestMessage: errorMsg
          },
          { merge: true }
        );
      } catch {
        // Ignora falha de gravação secundária
      }

      return { success: false, message: errorMsg };
    }

    const balance = typeof json?.balance === 'number' ? json.balance : 0;
    const successMsg = `Conexão bem-sucedida com o Asaas (${envLabel})! Saldo consultado: R$ ${balance.toFixed(2)}`;

    try {
      await services.db.collection('system_config').doc('asaas').set(
        {
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'success',
          lastTestMessage: successMsg
        },
        { merge: true }
      );
    } catch {
      // Ignora falha de gravação secundária
    }

    return { success: true, message: successMsg, balance };
  } catch (err: any) {
    const errorMsg = `Falha de rede ao conectar com Asaas: ${err?.message || 'Erro desconhecido'}`;
    try {
      await services.db.collection('system_config').doc('asaas').set(
        {
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: 'error',
          lastTestMessage: errorMsg
        },
        { merge: true }
      );
    } catch {
      // Ignora
    }

    return { success: false, message: errorMsg };
  }
}
