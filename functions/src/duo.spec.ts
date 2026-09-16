import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptDuoInviteBackend } from './duo.js';

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
