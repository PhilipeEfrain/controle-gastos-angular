import { describe, it, expect, vi } from 'vitest';
import {
  calculateMonthOffset,
  getRetentionLimitMonths,
  isCycleExpiredForPlan,
  cleanupUserExpiredCycles,
  cleanupAllExpiredCycles
} from './cleanup.js';

describe('Cleanup Utility Functions', () => {
  describe('calculateMonthOffset', () => {
    it('deve calcular o offset de meses corretamente no mesmo ano', () => {
      expect(calculateMonthOffset('2026-09', '2026-09')).toBe(0);
      expect(calculateMonthOffset('2026-08', '2026-09')).toBe(-1);
      expect(calculateMonthOffset('2026-06', '2026-09')).toBe(-3);
      expect(calculateMonthOffset('2026-10', '2026-09')).toBe(1);
    });

    it('deve calcular o offset de meses corretamente através da virada de ano', () => {
      expect(calculateMonthOffset('2025-12', '2026-01')).toBe(-1);
      expect(calculateMonthOffset('2026-01', '2025-12')).toBe(1);
      expect(calculateMonthOffset('2025-09', '2026-09')).toBe(-12);
    });

    it('deve retornar 0 para entradas inválidas', () => {
      expect(calculateMonthOffset('', '2026-09')).toBe(0);
      expect(calculateMonthOffset('invalid', '2026-09')).toBe(0);
    });
  });

  describe('getRetentionLimitMonths', () => {
    it('deve retornar 3 para o plano free ou indefinido', () => {
      expect(getRetentionLimitMonths('free')).toBe(3);
      expect(getRetentionLimitMonths(undefined)).toBe(3);
      expect(getRetentionLimitMonths('')).toBe(3);
    });

    it('deve retornar 12 para pro ou duo', () => {
      expect(getRetentionLimitMonths('pro')).toBe(12);
      expect(getRetentionLimitMonths('PRO')).toBe(12);
      expect(getRetentionLimitMonths('duo')).toBe(12);
      expect(getRetentionLimitMonths('DUO')).toBe(12);
    });
  });

  describe('isCycleExpiredForPlan', () => {
    it('Cenário BDD: Plano Free (3 ativos + 1 carência = 4 meses permitidos)', () => {
      const base = '2026-09';
      // 3 meses ativos: 09, 08, 07
      expect(isCycleExpiredForPlan('2026-09', base, 'free')).toBe(false);
      expect(isCycleExpiredForPlan('2026-08', base, 'free')).toBe(false);
      expect(isCycleExpiredForPlan('2026-07', base, 'free')).toBe(false);

      // 1 mês de carência (+1): 2026-06 (offset -3) -> NÃO deve ser excluído ainda!
      expect(isCycleExpiredForPlan('2026-06', base, 'free')).toBe(false);

      // Expirado: 2026-05 (offset -4) -> DEVE ser excluído!
      expect(isCycleExpiredForPlan('2026-05', base, 'free')).toBe(true);
      expect(isCycleExpiredForPlan('2026-01', base, 'free')).toBe(true);
    });

    it('Cenário BDD: Plano Pro (12 ativos + 1 carência = 13 meses permitidos)', () => {
      const base = '2026-09';
      // Ativos: 2026-09 até 2025-10 (offset 0 a -11)
      expect(isCycleExpiredForPlan('2026-09', base, 'pro')).toBe(false);
      expect(isCycleExpiredForPlan('2025-10', base, 'pro')).toBe(false);

      // Carência: 2025-09 (offset -12) -> NÃO deve ser excluído!
      expect(isCycleExpiredForPlan('2025-09', base, 'pro')).toBe(false);

      // Expirado: 2025-08 (offset -13) -> DEVE ser excluído!
      expect(isCycleExpiredForPlan('2025-08', base, 'pro')).toBe(true);
    });
  });

  describe('cleanupUserExpiredCycles', () => {
    it('deve excluir apenas ciclos e despesas expirados e preservar ciclos ativos e em carência', async () => {
      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined)
      };

      const mockDb: any = {
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn()
      };

      // Simula ciclos no Firestore para usuário Free em 2026-09
      // '2026-09' (ativo), '2026-06' (carência), '2026-05' (expirado)
      const mockCyclesDocs = [
        { id: '2026-09', ref: { path: 'users/u1/ciclos_mensais/2026-09' } },
        { id: '2026-06', ref: { path: 'users/u1/ciclos_mensais/2026-06' } },
        { id: '2026-05', ref: { path: 'users/u1/ciclos_mensais/2026-05' } }
      ];

      const mockExpenses202605 = [
        { id: 'exp-1', ref: { path: 'users/u1/ciclos_mensais/2026-05/despesas/exp-1' } },
        { id: 'exp-2', ref: { path: 'users/u1/ciclos_mensais/2026-05/despesas/exp-2' } }
      ];

      mockDb.collection.mockImplementation((path: string) => {
        if (path === 'users/u1/ciclos_mensais') {
          return {
            get: vi.fn().mockResolvedValue({ docs: mockCyclesDocs })
          };
        }
        if (path === 'users/u1/ciclos_mensais/2026-05/despesas') {
          return {
            get: vi.fn().mockResolvedValue({ docs: mockExpenses202605 })
          };
        }
        return {
          get: vi.fn().mockResolvedValue({ docs: [] })
        };
      });

      const refDate = new Date(2026, 8, 15); // Setembro/2026
      const result = await cleanupUserExpiredCycles(mockDb, 'u1', 'free', refDate);

      expect(result.cyclesDeleted).toBe(1);
      expect(result.expensesDeleted).toBe(2);
      expect(mockBatch.delete).toHaveBeenCalledTimes(3); // 2 despesas + 1 ciclo
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupAllExpiredCycles', () => {
    it('deve processar todos os usuários da base e retornar contadores agregados', async () => {
      const mockDb: any = {
        collection: vi.fn().mockImplementation((path: string) => {
          if (path === 'users') {
            return {
              get: vi.fn().mockResolvedValue({
                docs: [
                  { id: 'u1', data: () => ({ plan: 'free' }) },
                  { id: 'u2', data: () => ({ plan: 'pro' }) }
                ]
              })
            };
          }
          return {
            get: vi.fn().mockResolvedValue({ docs: [] })
          };
        }),
        batch: vi.fn().mockReturnValue({
          delete: vi.fn(),
          commit: vi.fn().mockResolvedValue(undefined)
        })
      };

      const result = await cleanupAllExpiredCycles(mockDb, new Date(2026, 8, 1));
      expect(result.success).toBe(true);
      expect(result.usersProcessed).toBe(2);
    });
  });
});
