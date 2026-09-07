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

/**
 * Converte de forma resiliente qualquer formato de data do Firestore (Timestamp, string ISO, string com seconds, objeto) para objeto Date
 */
export function parseFirestoreDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      return val.toDate();
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000);
    }
    if (typeof val._seconds === 'number') {
      return new Date(val._seconds * 1000);
    }
  }
  if (typeof val === 'string') {
    // Caso venha como string "Timestamp(seconds=1788137082, nanoseconds=770000000)"
    const match = val.match(/seconds=(\d+)/);
    if (match) {
      return new Date(Number(match[1]) * 1000);
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof val === 'number') {
    return new Date(val);
  }
  return null;
}

/**
 * Calcula a diferença em meses entre o mês alvo e um mês base (padrão: mês atual)
 * Retorna número negativo para meses no passado e positivo para meses no futuro
 * Ex: target "2026-08", base "2026-09" -> -1
 */
export function getMonthOffset(targetYearMonth: string, baseYearMonth: string = getCurrentYearMonth()): number {
  if (!targetYearMonth || !baseYearMonth) return 0;
  const [targetY, targetM] = targetYearMonth.split('-').map(Number);
  const [baseY, baseM] = baseYearMonth.split('-').map(Number);
  if (isNaN(targetY) || isNaN(targetM) || isNaN(baseY) || isNaN(baseM)) return 0;
  return (targetY - baseY) * 12 + (targetM - baseM);
}


