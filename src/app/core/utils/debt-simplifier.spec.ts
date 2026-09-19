import { describe, it, expect } from 'vitest';
import { calculateEqualShares, calculateGroupSummary } from './debt-simplifier';
import { SplitParticipant, SplitExpense } from '../models/split-group.model';

describe('debt-simplifier', () => {
  describe('calculateEqualShares', () => {
    it('deve distribuir R$ 100,00 entre 3 pessoas sem perder centavos', () => {
      const shares = calculateEqualShares(100, ['p1', 'p2', 'p3']);
      expect(shares.length).toBe(3);

      const sum = shares.reduce((acc, s) => acc + s.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(100);

      // 33.34 + 33.33 + 33.33 = 100.00
      expect(shares[0].amount).toBe(33.34);
      expect(shares[1].amount).toBe(33.33);
      expect(shares[2].amount).toBe(33.33);
    });

    it('deve retornar array vazio se não houver participantes ou valor for <= 0', () => {
      expect(calculateEqualShares(0, ['p1'])).toEqual([]);
      expect(calculateEqualShares(100, [])).toEqual([]);
    });
  });

  describe('calculateGroupSummary', () => {
    it('deve simplificar débitos corretamente em um churrasco entre 4 amigos', () => {
      const participants: SplitParticipant[] = [
        { id: 'p1', name: 'Alice', pixKey: 'alice@email.com', pixKeyType: 'email' },
        { id: 'p2', name: 'Bob', pixKey: '11999999999', pixKeyType: 'telefone' },
        { id: 'p3', name: 'Carlos' },
        { id: 'p4', name: 'Daniel' }
      ];

      // Alice pagou R$ 200 de carne (divisão igual entre todos: 50 para cada)
      // Bob pagou R$ 100 de bebidas (divisão igual entre todos: 25 para cada)
      const expenses: SplitExpense[] = [
        {
          id: 'e1',
          groupId: 'g1',
          description: 'Carne',
          amount: 200,
          paidByParticipantId: 'p1',
          splitType: 'equal',
          shares: [
            { participantId: 'p1', amount: 50 },
            { participantId: 'p2', amount: 50 },
            { participantId: 'p3', amount: 50 },
            { participantId: 'p4', amount: 50 }
          ],
          date: '2026-09-16'
        },
        {
          id: 'e2',
          groupId: 'g1',
          description: 'Bebidas',
          amount: 100,
          paidByParticipantId: 'p2',
          splitType: 'equal',
          shares: [
            { participantId: 'p1', amount: 25 },
            { participantId: 'p2', amount: 25 },
            { participantId: 'p3', amount: 25 },
            { participantId: 'p4', amount: 25 }
          ],
          date: '2026-09-16'
        }
      ];

      // Total gasto: 300. Cota de cada um: 75
      // Alice: pagou 200, deve 75 -> Saldo: +125 (credora)
      // Bob: pagou 100, deve 75 -> Saldo: +25 (credor)
      // Carlos: pagou 0, deve 75 -> Saldo: -75 (devedor)
      // Daniel: pagou 0, deve 75 -> Saldo: -75 (devedor)
      const summary = calculateGroupSummary(participants, expenses);

      expect(summary.totalAmount).toBe(300);
      expect(summary.expensesCount).toBe(2);

      const aliceBal = summary.balances.find((b) => b.participantId === 'p1');
      const bobBal = summary.balances.find((b) => b.participantId === 'p2');
      const carlosBal = summary.balances.find((b) => b.participantId === 'p3');
      const danielBal = summary.balances.find((b) => b.participantId === 'p4');

      expect(aliceBal?.netBalance).toBe(125);
      expect(bobBal?.netBalance).toBe(25);
      expect(carlosBal?.netBalance).toBe(-75);
      expect(danielBal?.netBalance).toBe(-75);

      // As liquidações devem saldar os 150 devidos com transferências diretas e levar as chaves PIX
      const totalSettled = summary.settlements.reduce((acc, s) => acc + s.amount, 0);
      expect(totalSettled).toBe(150);

      // Verifica se as transferências para Alice possuem a chave PIX dela
      const toAlice = summary.settlements.filter((s) => s.toParticipantId === 'p1');
      expect(toAlice.every((s) => s.toPixKey === 'alice@email.com')).toBe(true);
    });

    it('deve retornar settlements vazio quando ninguém deve a ninguém', () => {
      const participants: SplitParticipant[] = [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' }
      ];

      // Alice pagou 50 para os dois (cota 25 cada)
      // Bob pagou 50 para os dois (cota 25 cada)
      const expenses: SplitExpense[] = [
        {
          groupId: 'g1',
          description: 'Item 1',
          amount: 50,
          paidByParticipantId: 'p1',
          splitType: 'equal',
          shares: [
            { participantId: 'p1', amount: 25 },
            { participantId: 'p2', amount: 25 }
          ],
          date: '2026-09-16'
        },
        {
          groupId: 'g1',
          description: 'Item 2',
          amount: 50,
          paidByParticipantId: 'p2',
          splitType: 'equal',
          shares: [
            { participantId: 'p1', amount: 25 },
            { participantId: 'p2', amount: 25 }
          ],
          date: '2026-09-16'
        }
      ];

      const summary = calculateGroupSummary(participants, expenses);
      expect(summary.settlements).toEqual([]);
      expect(summary.balances.every((b) => b.netBalance === 0)).toBe(true);
    });
  });
});
