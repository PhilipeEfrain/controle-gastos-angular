import {
  DebtSettlement,
  SplitExpense,
  SplitExpenseShare,
  SplitGroupSummary,
  SplitParticipant,
  SplitParticipantBalance
} from '../models/split-group.model';

/**
 * Calcula as cotas iguais entre os participantes informados,
 * distribuindo eventuais centavos residuais para evitar dízimas periódicas.
 */
export function calculateEqualShares(
  totalAmount: number,
  participantIds: string[]
): SplitExpenseShare[] {
  if (!participantIds.length || totalAmount <= 0) {
    return [];
  }

  const totalCents = Math.round(totalAmount * 100);
  const count = participantIds.length;
  const baseShareCents = Math.floor(totalCents / count);
  let remainderCents = totalCents % count;

  return participantIds.map((participantId) => {
    const shareCents = baseShareCents + (remainderCents > 0 ? 1 : 0);
    if (remainderCents > 0) {
      remainderCents--;
    }
    return {
      participantId,
      amount: shareCents / 100
    };
  });
}

/**
 * Computa o sumário consolidado do grupo:
 * - Balanço líquido de cada participante (pago vs devido)
 * - Lista otimizada de liquidações PIX (quem transfere para quem)
 */
export function calculateGroupSummary(
  participants: SplitParticipant[],
  expenses: SplitExpense[]
): SplitGroupSummary {
  const participantsMap = new Map<string, SplitParticipant>();
  participants.forEach((p) => participantsMap.set(p.id, p));

  const totalPaidMap = new Map<string, number>();
  const totalOwedMap = new Map<string, number>();

  // Inicializa mapa para todos os participantes
  participants.forEach((p) => {
    totalPaidMap.set(p.id, 0);
    totalOwedMap.set(p.id, 0);
  });

  let grandTotalCents = 0;

  for (const exp of expenses) {
    const expenseCents = Math.round(exp.amount * 100);
    grandTotalCents += expenseCents;

    // Quem pagou a conta
    const currentPaid = totalPaidMap.get(exp.paidByParticipantId) || 0;
    totalPaidMap.set(exp.paidByParticipantId, currentPaid + expenseCents);

    // Quem deve sua parte nessa conta
    for (const share of exp.shares) {
      const shareCents = Math.round(share.amount * 100);
      const currentOwed = totalOwedMap.get(share.participantId) || 0;
      totalOwedMap.set(share.participantId, currentOwed + shareCents);
    }
  }

  // Monta os balanços por participante
  const balances: SplitParticipantBalance[] = participants.map((p) => {
    const paidCents = totalPaidMap.get(p.id) || 0;
    const owedCents = totalOwedMap.get(p.id) || 0;
    const netCents = paidCents - owedCents;

    return {
      participantId: p.id,
      participantName: p.name,
      totalPaid: paidCents / 100,
      totalOwed: owedCents / 100,
      netBalance: netCents / 100,
      pixKey: p.pixKey,
      pixKeyType: p.pixKeyType
    };
  });

  // Algoritmo de Simplificação de Débitos (Debt Minimizer)
  const settlements = simplifyDebts(balances, participantsMap);

  return {
    totalAmount: grandTotalCents / 100,
    expensesCount: expenses.length,
    balances,
    settlements
  };
}

/**
 * Algoritmo de minimização de transações usando abordagem gulosa com inteiros (centavos).
 */
export function simplifyDebts(
  balances: SplitParticipantBalance[],
  participantsMap: Map<string, SplitParticipant>
): DebtSettlement[] {
  interface NetNode {
    id: string;
    name: string;
    netCents: number;
    pixKey?: string;
    pixKeyType?: SplitParticipant['pixKeyType'];
  }

  const creditors: NetNode[] = [];
  const debtors: NetNode[] = [];

  for (const b of balances) {
    const netCents = Math.round(b.netBalance * 100);
    const participant = participantsMap.get(b.participantId);

    if (netCents > 0) {
      creditors.push({
        id: b.participantId,
        name: b.participantName,
        netCents,
        pixKey: participant?.pixKey,
        pixKeyType: participant?.pixKeyType
      });
    } else if (netCents < 0) {
      debtors.push({
        id: b.participantId,
        name: b.participantName,
        netCents: -netCents // armazena o valor absoluto da dívida
      });
    }
  }

  // Ordena decrescente pelo valor para casar maiores dívidas com maiores créditos
  creditors.sort((a, b) => b.netCents - a.netCents);
  debtors.sort((a, b) => b.netCents - a.netCents);

  const settlements: DebtSettlement[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const cred = creditors[cIdx];
    const deb = debtors[dIdx];

    const settleCents = Math.min(cred.netCents, deb.netCents);

    if (settleCents > 0) {
      settlements.push({
        fromParticipantId: deb.id,
        fromParticipantName: deb.name,
        toParticipantId: cred.id,
        toParticipantName: cred.name,
        toPixKey: cred.pixKey,
        toPixKeyType: cred.pixKeyType,
        amount: settleCents / 100
      });

      cred.netCents -= settleCents;
      deb.netCents -= settleCents;
    }

    if (cred.netCents === 0) {
      cIdx++;
    }
    if (deb.netCents === 0) {
      dIdx++;
    }
  }

  return settlements;
}
