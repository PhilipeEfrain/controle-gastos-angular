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

export type DueDateStatus = 'overdue' | 'due_today' | 'due_soon' | 'paid' | 'normal';

export interface DueDateInfo {
  status: DueDateStatus;
  daysDiff: number;
  label: string;
  tooltip: string;
  badgeClass: string;
}

/**
 * Formata data de forma segura no padrão brasileiro DD/MM/AAAA
 * Suporta string YYYY-MM-DD, string ISO, objeto Date ou Timestamp do Firestore
 */
export function formatDateBR(dateInput: any): string {
  if (!dateInput) return '-';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
  }

  const dateObj = parseFirestoreDate(dateInput);
  if (!dateObj) return '-';

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calcula a classificação e inteligência temporal de vencimento para uma despesa (CARD-059).
 * Preserva o fuso horário local e não penaliza despesas pagas ou rendas extras.
 *
 * @param dueDate Data de vencimento em YYYY-MM-DD, ISO ou Firestore Timestamp
 * @param isPaid Se a despesa já foi quitada
 * @param isIncome Se o lançamento é renda extra
 * @param referenceDate Data de referência para cálculo dos dias (padrão: hoje)
 */
export function getExpenseDueDateInfo(
  dueDate: string | Date | null | undefined,
  isPaid: boolean = false,
  isIncome: boolean = false,
  referenceDate: Date = new Date()
): DueDateInfo | null {
  if (!dueDate || isIncome) {
    return null;
  }

  if (isPaid) {
    return {
      status: 'paid',
      daysDiff: 0,
      label: 'Paga',
      tooltip: 'Despesa quitada com sucesso',
      badgeClass: 'badge-paid'
    };
  }

  // Normaliza referência localmente (zerando hora, minuto, segundo, milissegundo)
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  // Parsing seguro sem deslocamento de UTC
  let target: Date | null = null;
  if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
    const [y, m, d] = dueDate.trim().split('-').map(Number);
    target = new Date(y, m - 1, d);
  } else {
    target = parseFirestoreDate(dueDate);
  }

  if (!target || isNaN(target.getTime())) {
    return null;
  }
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - ref.getTime();
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    const absDays = Math.abs(daysDiff);
    const label = absDays === 1 ? 'Vencida ontem' : `Vencida há ${absDays} dias`;
    return {
      status: 'overdue',
      daysDiff,
      label,
      tooltip: `Atenção: esta conta venceu há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}. Regularize para evitar juros.`,
      badgeClass: 'badge-overdue'
    };
  }

  if (daysDiff === 0) {
    return {
      status: 'due_today',
      daysDiff: 0,
      label: 'Vence Hoje',
      tooltip: 'Atenção: esta conta vence hoje!',
      badgeClass: 'badge-due-today'
    };
  }

  if (daysDiff <= 3) {
    const label = daysDiff === 1 ? 'Vence amanhã' : `Vence em ${daysDiff} dias`;
    return {
      status: 'due_soon',
      daysDiff,
      label,
      tooltip: `Vencimento próximo (${label}). Fique atento ao fluxo da quinzena.`,
      badgeClass: 'badge-due-soon'
    };
  }

  return {
    status: 'normal',
    daysDiff,
    label: '',
    tooltip: '',
    badgeClass: ''
  };
}



