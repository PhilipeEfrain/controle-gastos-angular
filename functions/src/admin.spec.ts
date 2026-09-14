import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUserCascade, testAsaasConnectionBackend } from './admin.js';

describe('Admin Delete User Functions Unit Tests (CARD-082)', () => {
  let mockDb: any;
  let mockAuth: any;
  let callerUserDoc: any;
  let targetUserDoc: any;
  let partnerUserDoc: any;

  beforeEach(() => {
    callerUserDoc = {
      exists: true,
      data: () => ({
        role: 'admin',
        email: 'admin@quinzena.com.br'
      })
    };

    targetUserDoc = {
      exists: true,
      data: () => ({
        role: 'user',
        email: 'usuario@exemplo.com',
        duoPartnerId: null
      })
    };

    partnerUserDoc = {
      exists: true,
      data: () => ({
        role: 'user',
        email: 'parceiro@exemplo.com',
        duoPartnerId: 'target-123'
      })
    };

    const targetDocRefMock = {
      get: vi.fn().mockImplementation(() => Promise.resolve(targetUserDoc)),
      delete: vi.fn().mockResolvedValue({})
    };

    const partnerDocRefMock = {
      get: vi.fn().mockImplementation(() => Promise.resolve(partnerUserDoc)),
      update: vi.fn().mockResolvedValue({})
    };

    const callerDocRefMock = {
      get: vi.fn().mockImplementation(() => Promise.resolve(callerUserDoc))
    };

    const systemEventsMock = {
      add: vi.fn().mockResolvedValue({ id: 'event-1' })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'system_events') {
          return systemEventsMock;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn((docId: string) => {
              if (docId === 'admin-uid') return callerDocRefMock;
              if (docId === 'target-123') return targetDocRefMock;
              if (docId === 'partner-456') return partnerDocRefMock;
              return {
                get: vi.fn().mockResolvedValue({ exists: false, data: () => null })
              };
            })
          };
        }
        return {
          doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) })
        };
      }),
      recursiveDelete: vi.fn().mockResolvedValue({})
    };

    mockAuth = {
      deleteUser: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('deve rejeitar requisição sem targetUid válido', async () => {
    await expect(
      deleteUserCascade({ targetUid: '' }, 'admin-uid', { db: mockDb, auth: mockAuth })
    ).rejects.toThrow('O UID do usuário alvo é obrigatório.');
  });

  it('deve impedir que o administrador exclua sua própria conta', async () => {
    await expect(
      deleteUserCascade({ targetUid: 'admin-uid' }, 'admin-uid', { db: mockDb, auth: mockAuth })
    ).rejects.toThrow('Um administrador não pode excluir sua própria conta pelo painel.');
  });

  it('deve rejeitar se o usuário solicitante não for admin', async () => {
    callerUserDoc = {
      exists: true,
      data: () => ({ role: 'user', email: 'impostor@exemplo.com' })
    };

    await expect(
      deleteUserCascade({ targetUid: 'target-123' }, 'admin-uid', { db: mockDb, auth: mockAuth })
    ).rejects.toThrow('Acesso negado: Requer privilégios de administrador.');
  });

  it('deve executar exclusão recursiva no Firestore, remover credencial do Auth e registrar log', async () => {
    const result = await deleteUserCascade(
      { targetUid: 'target-123', reason: 'Solicitação do titular' },
      'admin-uid',
      { db: mockDb, auth: mockAuth }
    );

    expect(result.success).toBe(true);
    expect(result.targetUid).toBe('target-123');
    expect(mockDb.recursiveDelete).toHaveBeenCalled();
    expect(mockAuth.deleteUser).toHaveBeenCalledWith('target-123');

    const systemEventsCol = mockDb.collection('system_events');
    expect(systemEventsCol.add).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'USER_DELETED_BY_ADMIN',
        adminUid: 'admin-uid',
        targetUid: 'target-123',
        targetEmail: 'usuario@exemplo.com',
        reason: 'Solicitação do titular'
      })
    );
  });

  it('deve desvincular parceiro Duo caso o usuário excluído possua vínculo', async () => {
    targetUserDoc = {
      exists: true,
      data: () => ({
        role: 'user',
        email: 'duo.titular@exemplo.com',
        duoPartnerId: 'partner-456'
      })
    };

    await deleteUserCascade(
      { targetUid: 'target-123' },
      'admin-uid',
      { db: mockDb, auth: mockAuth }
    );

    const partnerDoc = mockDb.collection('users').doc('partner-456');
    expect(partnerDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        duoPartnerId: null,
        duoGroupId: null
      })
    );
  });

  it('deve prosseguir normalmente mesmo se o usuário já não existir no Auth (auth/user-not-found)', async () => {
    mockAuth.deleteUser.mockRejectedValueOnce({ code: 'auth/user-not-found' });

    const result = await deleteUserCascade(
      { targetUid: 'target-123' },
      'admin-uid',
      { db: mockDb, auth: mockAuth }
    );

    expect(result.success).toBe(true);
    expect(mockDb.recursiveDelete).toHaveBeenCalled();
  });
});

describe('Admin Test Asaas Connection Backend Unit Tests', () => {
  let mockDb: any;
  let callerUserDoc: any;
  let systemConfigDocMock: any;

  beforeEach(() => {
    callerUserDoc = {
      exists: true,
      data: () => ({
        role: 'admin',
        email: 'admin@quinzena.com.br'
      })
    };

    systemConfigDocMock = {
      set: vi.fn().mockResolvedValue({})
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'system_config') {
          return {
            doc: vi.fn().mockReturnValue(systemConfigDocMock)
          };
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockImplementation(() => Promise.resolve(callerUserDoc))
            })
          };
        }
        return {
          doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) })
        };
      })
    };
  });

  it('deve rejeitar se apiKey for vazia ou curta', async () => {
    await expect(
      testAsaasConnectionBackend({ apiKey: '' }, 'admin-uid', { db: mockDb })
    ).rejects.toThrow('A chave de API (Access Token) não pode ser vazia.');

    await expect(
      testAsaasConnectionBackend({ apiKey: 'curta' }, 'admin-uid', { db: mockDb })
    ).rejects.toThrow('A chave de API informada é muito curta ou inválida.');
  });

  it('deve rejeitar se chamador não for admin', async () => {
    callerUserDoc = {
      exists: true,
      data: () => ({ role: 'user', email: 'user@exemplo.com' })
    };

    await expect(
      testAsaasConnectionBackend({ apiKey: '$aact_valido_com_mais_de_dez_chars' }, 'user-uid', { db: mockDb })
    ).rejects.toThrow('Acesso negado: Requer privilégios de administrador.');
  });

  it('deve retornar sucesso com saldo quando Asaas responder 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ balance: 4500.50 })
    });

    const result = await testAsaasConnectionBackend(
      { apiKey: '$aact_prod_123456789012345', environment: 'production' },
      'admin-uid',
      { db: mockDb, fetchFn: fakeFetch as any }
    );

    expect(result.success).toBe(true);
    expect(result.balance).toBe(4500.50);
    expect(result.message).toContain('Conexão bem-sucedida');
    expect(result.message).toContain('4500.50');
    expect(systemConfigDocMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastTestStatus: 'success'
      }),
      { merge: true }
    );
  });

  it('deve retornar falha amigável quando Asaas responder 401 Unauthorized', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({
        errors: [{ description: 'Chave de API inválida' }]
      })
    });

    const result = await testAsaasConnectionBackend(
      { apiKey: '$aact_invalido_12345678', environment: 'sandbox' },
      'admin-uid',
      { db: mockDb, fetchFn: fakeFetch as any }
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Falha de Autenticação (401)');
    expect(systemConfigDocMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastTestStatus: 'error'
      }),
      { merge: true }
    );
  });

  it('deve capturar falhas de rede sem crashar a execução', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const result = await testAsaasConnectionBackend(
      { apiKey: '$aact_qualquer_chave_longa', environment: 'sandbox' },
      'admin-uid',
      { db: mockDb, fetchFn: fakeFetch as any }
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Network connection timeout');
  });
});
