import { FortnightNumber } from '../models/finance.model';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Retorna o mês atual no formato YYYY-MM
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Identifica se um determinado dia do mês pertence à Quinzena 1 ou Quinzena 2
 * Regra do Negócio:
 * - Dia 1 ao Dia 15: Quinzena 2 (Dia 15 / 2º Período)
 * - Dia 16 ao Dia 31: Quinzena 1 (Dia 31 / 1º Período)
 */
export function getFortnightFromDay(dateOrDay: Date | string | number): FortnightNumber {
  let day: number;

  if (typeof dateOrDay === 'number') {
    day = dateOrDay;
  } else if (dateOrDay instanceof Date) {
    day = dateOrDay.getDate();
  } else {
    // String no formato YYYY-MM-DD
    const parts = dateOrDay.split('-');
    if (parts.length === 3) {
      day = parseInt(parts[2], 10);
    } else {
      day = new Date(dateOrDay).getDate();
    }
  }

  return day <= 15 ? 2 : 1;
}

/**
 * Formata um 'YYYY-MM' para formato amigável
 * Ex: "2025-03" -> "Março de 2025"
 */
export function formatYearMonthLabel(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) {
    return yearMonth;
  }

  const [yearStr, monthStr] = yearMonth.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] || monthStr;

  return `${monthName} de ${yearStr}`;
}
