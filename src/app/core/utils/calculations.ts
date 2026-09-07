import { Expense, FortnightNumber, MonthBalanceSummary } from '../models/finance.model';

/**
 * Arredonda um número para 2 casas decimais evitando erros de ponto flutuante
 */
export function roundBRL(num: number | null | undefined): number {
  if (num === null || num === undefined || isNaN(num)) {
    return 0;
  }
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Soma valores de uma coleção de despesas (itens onde tipo !== 'renda_extra')
 */
export function sumExpenses(items: Expense[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  const total = items
    .filter(item => item.tipo !== 'renda_extra')
    .reduce((acc, curr) => acc + (curr.valor || 0), 0);
  return roundBRL(total);
}

/**
 * Soma valores de entradas/rendas extras (itens onde tipo === 'renda_extra')
 */
export function sumExtraIncomes(items: Expense[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  const total = items
    .filter(item => item.tipo === 'renda_extra')
    .reduce((acc, curr) => acc + (curr.valor || 0), 0);
  return roundBRL(total);
}

/**
 * Filtra despesas/itens pertencentes a uma quinzena específica
 */
export function filterExpensesByFortnight(items: Expense[], quinzena: FortnightNumber): Expense[] {
  if (!items || items.length === 0) {
    return [];
  }
  return items.filter(e => e.quinzena === quinzena);
}

/**
 * Calcula o saldo da quinzena (Renda Base + Rendas Extras - Gastos)
 */
export function calculateFortnightBalance(income: number, items: Expense[]): number {
  const extraIncome = sumExtraIncomes(items);
  const totalExpenses = sumExpenses(items);
  return roundBRL((income || 0) + extraIncome - totalExpenses);
}

/**
 * Calcula o balanço consolidado global do mês e análise de déficit quinzenal
 */
export function calculateGlobalBalance(
  rendaQ1: number,
  rendaQ2: number,
  items: Expense[]
): MonthBalanceSummary {
  const q1Items = filterExpensesByFortnight(items, 1);
  const q2Items = filterExpensesByFortnight(items, 2);

  const extraQ1 = sumExtraIncomes(q1Items);
  const extraQ2 = sumExtraIncomes(q2Items);

  const safeRendaQ1 = roundBRL((rendaQ1 || 0) + extraQ1);
  const safeRendaQ2 = roundBRL((rendaQ2 || 0) + extraQ2);

  const totalGastosQ1 = sumExpenses(q1Items);
  const totalGastosQ2 = sumExpenses(q2Items);

  const saldoQ1 = roundBRL(safeRendaQ1 - totalGastosQ1);
  const saldoQ2 = roundBRL(safeRendaQ2 - totalGastosQ2);

  const totalRenda = roundBRL(safeRendaQ1 + safeRendaQ2);
  const totalGastos = roundBRL(totalGastosQ1 + totalGastosQ2);
  const saldoFinal = roundBRL(totalRenda - totalGastos);

  // Percentuais de comprometimento da renda
  const percentualGastoQ1 = safeRendaQ1 > 0 ? roundBRL((totalGastosQ1 / safeRendaQ1) * 100) : 0;
  const percentualGastoQ2 = safeRendaQ2 > 0 ? roundBRL((totalGastosQ2 / safeRendaQ2) * 100) : 0;

  // Análise de Cobertura: Se a Q2 estiver negativa, a sobra da Q1 consegue cobrir?
  const q1CobreQ2 = saldoQ2 < 0 ? roundBRL(saldoQ1 + saldoQ2) >= 0 : true;

  return {
    totalRenda,
    totalGastos,
    saldoFinal,
    temDeficitGlobal: saldoFinal < 0,
    q1: {
      quinzena: 1,
      label: 'Quinzena 1 (Dia 31)',
      renda: safeRendaQ1,
      totalGastos: totalGastosQ1,
      saldo: saldoQ1,
      isDeficit: saldoQ1 < 0,
      percentualGasto: percentualGastoQ1
    },
    q2: {
      quinzena: 2,
      label: 'Quinzena 2 (Dia 15)',
      renda: safeRendaQ2,
      totalGastos: totalGastosQ2,
      saldo: saldoQ2,
      isDeficit: saldoQ2 < 0,
      percentualGasto: percentualGastoQ2
    },
    q1CobreQ2
  };
}

/**
 * Projeta N meses para frente ou para trás a partir de um mês YYYY-MM
 * Ex: addMonthsToYearMonth("2025-11", 2) -> "2026-01"
 */
export function addMonthsToYearMonth(yearMonth: string, count: number): string {
  if (!yearMonth || !yearMonth.includes('-')) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Date em JS: mês é 0-indexado (0 = Janeiro, 11 = Dezembro)
  const targetDate = new Date(year, month - 1 + count, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');

  return `${targetYear}-${targetMonth}`;
}
