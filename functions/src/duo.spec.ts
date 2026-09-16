import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptDuoInviteBackend, disconnectDuoPartnerBackend, cleanupOldDuoPartnerLinks } from './duo.js';

describe('acceptDuoInviteBackend', () => {
  let mockDb: any;
  let mockGroupUpdateFn: any;
  let mockUserSetFn: any;
  let mockGroupDoc: any;
  let mockGroupsQuery: any;

  beforeEach(() => {
    mockGroupUpdateFn = vi.fn().mockResolvedValue(true);
    mockUserSetFn = vi.fn().mockResolvedValue(true);

    mockGroupDoc = {
      id: 'duo_grp_999',
      data: vi.fn().mockReturnValue({
        ownerId: 'user_owner_111',
        ownerName: 'Maria Silva',
        ownerEmail: 'maria@exemplo.com',
        inviteCode: 'DUO-7788',
        status: 'pending',
        partnerId: null
      }),
      ref: {
        update: mockGroupUpdateFn
      }
    };

    mockGroupsQuery = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [mockGroupDoc]
      })
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'duo_groups') {
          return mockGroupsQuery;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({
              set: mockUserSetFn
            }))
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se o usuário não estiver autenticado', async () => {
    await expect(
      acceptDuoInviteBackend({ inviteCode: 'DUO-7788' }, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve rejeitar código de convite inválido ou muito curto', async () => {
    await expect(
      acceptDuoInviteBackend({ inviteCode: 'AB' }, 'user_partner_222', { db: mockDb })
    ).rejects.toThrow('Código de convite inválido');
  });

  it('deve rejeitar quando o código de convite não for localizado no Firestore', async () => {
    mockGroupsQuery.get.mockResolvedValueOnce({
      empty: true,
      docs: []
    });

    await expect(
      acceptDuoInviteBackend({ inviteCode: 'DUO-0000' }, 'user_partner_222', { db: mockDb })
    ).rejects.toThrow('Código de convite não encontrado, expirado ou já utilizado');
  });

  it('deve rejeitar se o titular tentar se conectar ao próprio convite', async () => {
    await expect(
      acceptDuoInviteBackend({ inviteCode: 'DUO-7788' }, 'user_owner_111', { db: mockDb })
    ).rejects.toThrow('Você não pode se conectar ao seu próprio convite');
  });

  it('deve processar o pareamento com sucesso, atualizando grupo e perfil dos dois usuários', async () => {
    const res = await acceptDuoInviteBackend(
      {
        inviteCode: 'DUO-7788',
        partnerEmail: 'joao@exemplo.com',
        partnerName: 'João Silva'
      },
      'user_partner_222',
      { db: mockDb }
    );

    expect(res.success).toBe(true);
    expect(res.groupId).toBe('duo_grp_999');
    expect(res.ownerId).toBe('user_owner_111');
    expect(res.ownerName).toBe('Maria Silva');

    // Verifica que o grupo foi atualizado para status active
    expect(mockGroupUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'user_partner_222',
        partnerEmail: 'joao@exemplo.com',
        partnerName: 'João Silva',
        status: 'active'
      })
    );

    // Verifica que o perfil do parceiro foi promovido para plano Duo
    expect(mockUserSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'duo',
        planStatus: 'active',
        duoPartnerId: 'user_owner_111',
        duoGroupId: 'duo_grp_999'
      }),
      { merge: true }
    );

    // Verifica que o perfil do titular foi vinculado ao parceiro
    expect(mockUserSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        duoPartnerId: 'user_partner_222',
        duoGroupId: 'duo_grp_999'
      }),
      { merge: true }
    );
  });
});

describe('disconnectDuoPartnerBackend', () => {
  let mockDb: any;
  let mockGroupUpdateFn: any;
  let mockOwnerSetFn: any;
  let mockPartnerSetFn: any;
  let mockPartnerData: any;
  let mockGroupData: any;

  beforeEach(() => {
    mockGroupUpdateFn = vi.fn().mockResolvedValue(true);
    mockOwnerSetFn = vi.fn().mockResolvedValue(true);
    mockPartnerSetFn = vi.fn().mockResolvedValue(true);

    mockGroupData = {
      ownerId: 'usr_owner_1',
      ownerName: 'Owner User',
      partnerId: 'usr_partner_2',
      partnerName: 'Partner User',
      inviteCode: 'DUO-1234',
      status: 'active'
    };

    mockPartnerData = {
      plan: 'duo',
      planStatus: 'active',
      duoPartnerId: 'usr_owner_1',
      duoGroupId: 'grp_1'
    };

    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'duo_groups') {
          return {
            doc: vi.fn((groupId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: groupId === 'grp_1',
                data: () => mockGroupData
              }),
              update: mockGroupUpdateFn
            }))
          };
        }
        if (colName === 'users') {
          return {
            doc: vi.fn((userId: string) => {
              if (userId === 'usr_owner_1') {
                return {
                  get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ plan: 'duo' }) }),
                  set: mockOwnerSetFn
                };
              }
              if (userId === 'usr_partner_2') {
                return {
                  get: vi.fn().mockResolvedValue({ exists: true, data: () => mockPartnerData }),
                  set: mockPartnerSetFn
                };
              }
              return { get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() };
            })
          };
        }
        return { doc: vi.fn() };
      })
    };
  });

  it('deve rejeitar se não autenticado', async () => {
    await expect(
      disconnectDuoPartnerBackend({ groupId: 'grp_1' }, '', { db: mockDb })
    ).rejects.toThrow('Acesso não autenticado');
  });

  it('deve rejeitar se groupId for vazio', async () => {
    await expect(
      disconnectDuoPartnerBackend({ groupId: '' }, 'usr_owner_1', { db: mockDb })
    ).rejects.toThrow('Identificador do grupo Duo não fornecido');
  });

  it('deve rejeitar se o grupo não existir', async () => {
    await expect(
      disconnectDuoPartnerBackend({ groupId: 'non_existent' }, 'usr_owner_1', { db: mockDb })
    ).rejects.toThrow('Grupo Duo não encontrado');
  });

  it('deve rejeitar se quem chamou não for nem dono nem parceiro do grupo', async () => {
    await expect(
      disconnectDuoPartnerBackend({ groupId: 'grp_1' }, 'usr_intruder_3', { db: mockDb })
    ).rejects.toThrow('Você não possui permissão para gerenciar este grupo Duo');
  });

  it('Cenário 1: Titular (dono) desconecta o parceiro com sucesso', async () => {
    const res = await disconnectDuoPartnerBackend(
      { groupId: 'grp_1' },
      'usr_owner_1',
      { db: mockDb }
    );

    expect(res.success).toBe(true);
    expect(res.isOwner).toBe(true);
    expect(res.message).toBe('Parceiro desvinculado com sucesso.');

    // 1. Grupo deve voltar para status pending e ter novo código
    expect(mockGroupUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: null,
        partnerEmail: null,
        partnerName: null,
        status: 'pending',
        inviteCode: expect.stringMatching(/^DUO-\d{4}$/)
      })
    );

    // 2. Perfil do titular deve ter duoPartnerId limpo
    expect(mockOwnerSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ duoPartnerId: null }),
      { merge: true }
    );

    // 3. Parceiro deve voltar para free e ter vínculos limpos
    expect(mockPartnerSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        duoPartnerId: null,
        duoGroupId: null,
        plan: 'free',
        planStatus: 'active'
      }),
      { merge: true }
    );
  });

  it('Cenário 2: Parceiro se desconecta voluntariamente com sucesso', async () => {
    const res = await disconnectDuoPartnerBackend(
      { groupId: 'grp_1' },
      'usr_partner_2',
      { db: mockDb }
    );

    expect(res.success).toBe(true);
    expect(res.isOwner).toBe(false);
    expect(res.message).toBe('Você saiu do grupo Duo com sucesso.');

    expect(mockGroupUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', partnerId: null })
    );
    expect(mockPartnerSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free', duoPartnerId: null }),
      { merge: true }
    );
  });

  it('Cenário 3: Parceiro com assinatura paga própria NÃO tem plano rebaixado para free', async () => {
    mockPartnerData.asaasSubscriptionId = 'sub_active_own';
    mockPartnerData.planStatus = 'active';

    const res = await disconnectDuoPartnerBackend(
      { groupId: 'grp_1' },
      'usr_partner_2',
      { db: mockDb }
    );

    expect(res.success).toBe(true);
    expect(mockPartnerSetFn).toHaveBeenCalledWith(
      {
        duoPartnerId: null,
        duoGroupId: null,
        updatedAt: expect.any(String)
      },
      { merge: true }
    );
    // Não altera o plan para 'free'
    expect(mockPartnerSetFn).not.toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'free' }),
      expect.anything()
    );
  });
});

describe('cleanupOldDuoPartnerLinks', () => {
  it('deve desvincular grupos antigos onde o usuário figurava como parceiro', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(true);
    const mockOwnerSet = vi.fn().mockResolvedValue(true);

    const mockDb: any = {
      collection: vi.fn((colName: string) => {
        if (colName === 'duo_groups') {
          return {
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                docs: [
                  {
                    data: () => ({ ownerId: 'old_owner_1' }),
                    ref: { update: mockUpdate }
                  }
                ]
              })
            })
          };
        }
        if (colName === 'users') {
          return {
            doc: vi.fn(() => ({ set: mockOwnerSet }))
          };
        }
        return {};
      })
    };

    await cleanupOldDuoPartnerLinks('usr_partner_leaving', mockDb);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: null,
        status: 'pending',
        inviteCode: expect.stringMatching(/^DUO-\d{4}$/)
      })
    );
    expect(mockOwnerSet).toHaveBeenCalledWith(
      expect.objectContaining({ duoPartnerId: null }),
      { merge: true }
    );
  });
});
