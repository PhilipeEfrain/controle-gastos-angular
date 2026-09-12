import { describe, it, expect } from 'vitest';
import {
  getCurrentYearMonth,
  getFortnightFromDay,
  formatYearMonthLabel,
  parseFirestoreDate,
  getMonthOffset,
  formatDateBR,
  getExpenseDueDateInfo
} from './date';

describe('Date Utility', () => {
  describe('getCurrentYearMonth', () => {
    it('deve retornar string no formato YYYY-MM', () => {
      const ym = getCurrentYearMonth();
      expect(ym).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getFortnightFromDay', () => {
    it('deve identificar dia 1 a 15 como Quinzena 2 (Dia 15)', () => {
      expect(getFortnightFromDay(1)).toBe(2);
      expect(getFortnightFromDay(15)).toBe(2);
      expect(getFortnightFromDay('2025-03-10')).toBe(2);
    });

    it('deve identificar dia 16 a 31 como Quinzena 1 (Dia 31)', () => {
      expect(getFortnightFromDay(16)).toBe(1);
      expect(getFortnightFromDay(31)).toBe(1);
      expect(getFortnightFromDay('2025-03-25')).toBe(1);
    });
  });

  describe('formatYearMonthLabel', () => {
    it('deve formatar YYYY-MM para texto legível em português', () => {
      expect(formatYearMonthLabel('2025-03')).toBe('Março de 2025');
      expect(formatYearMonthLabel('2025-12')).toBe('Dezembro de 2025');
      expect(formatYearMonthLabel('2026-01')).toBe('Janeiro de 2026');
    });
  });

  describe('parseFirestoreDate', () => {
    it('deve converter Timestamp com toDate()', () => {
      const mockTimestamp = { toDate: () => new Date('2026-08-30T21:44:42.000Z') };
      const date = parseFirestoreDate(mockTimestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getUTCFullYear()).toBe(2026);
    });

    it('deve converter objeto com seconds', () => {
      const mockSeconds = { seconds: 1788137082, nanoseconds: 770000000 };
      const date = parseFirestoreDate(mockSeconds);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(1788137082000);
    });

    it('deve converter string formatada Timestamp(seconds=1788137082...)', () => {
      const dateStr = 'Timestamp(seconds=1788137082, nanoseconds=770000000)';
      const date = parseFirestoreDate(dateStr);
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(1788137082000);
    });

    it('deve converter string ISO padrão', () => {
      const isoStr = '2026-09-07T18:00:00.000Z';
      const date = parseFirestoreDate(isoStr);
      expect(date).toBeInstanceOf(Date);
      expect(date?.toISOString()).toBe(isoStr);
    });
  });

  describe('getMonthOffset', () => {
    it('deve calcular offset 0 para o mesmo mês', () => {
      expect(getMonthOffset('2026-09', '2026-09')).toBe(0);
    });

    it('deve calcular offset negativo para meses no passado', () => {
      expect(getMonthOffset('2026-08', '2026-09')).toBe(-1);
      expect(getMonthOffset('2026-07', '2026-09')).toBe(-2);
      expect(getMonthOffset('2025-09', '2026-09')).toBe(-12);
      expect(getMonthOffset('2025-08', '2026-09')).toBe(-13);
    });

    it('deve calcular offset positivo para meses no futuro', () => {
      expect(getMonthOffset('2026-10', '2026-09')).toBe(1);
      expect(getMonthOffset('2027-09', '2026-09')).toBe(12);
    });
  });

  describe('formatDateBR', () => {
    it('deve formatar string YYYY-MM-DD para DD/MM/AAAA', () => {
      expect(formatDateBR('2026-09-15')).toBe('15/09/2026');
      expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
      expect(formatDateBR('2026-12-31')).toBe('31/12/2026');
    });

    it('deve retornar hífen para valores nulos ou vazios', () => {
      expect(formatDateBR(null)).toBe('-');
      expect(formatDateBR(undefined)).toBe('-');
      expect(formatDateBR('')).toBe('-');
    });

    it('deve formatar Date ou Timestamp do Firestore', () => {
      const mockDate = new Date(2026, 8, 20); // 20 de setembro de 2026
      expect(formatDateBR(mockDate)).toBe('20/09/2026');
    });
  });

  describe('getExpenseDueDateInfo (CARD-059: Inteligência e Alertas de Vencimento)', () => {
    const fixedToday = new Date(2026, 8, 12, 10, 0, 0); // 12 de Setembro de 2026

    it('Cenário BDD 1: deve retornar status overdue para despesas vencidas no passado', () => {
      // Vencida ontem (11/09/2026)
      const yesterday = getExpenseDueDateInfo('2026-09-11', false, false, fixedToday);
      expect(yesterday?.status).toBe('overdue');
      expect(yesterday?.daysDiff).toBe(-1);
      expect(yesterday?.label).toBe('Vencida ontem');
      expect(yesterday?.badgeClass).toBe('badge-overdue');

      // Vencida há 5 dias (07/09/2026)
      const past5 = getExpenseDueDateInfo('2026-09-07', false, false, fixedToday);
      expect(past5?.status).toBe('overdue');
      expect(past5?.daysDiff).toBe(-5);
      expect(past5?.label).toBe('Vencida há 5 dias');
    });

    it('Cenário BDD 2: deve retornar status due_today para despesas que vencem hoje', () => {
      const todayExpense = getExpenseDueDateInfo('2026-09-12', false, false, fixedToday);
      expect(todayExpense?.status).toBe('due_today');
      expect(todayExpense?.daysDiff).toBe(0);
      expect(todayExpense?.label).toBe('Vence Hoje');
      expect(todayExpense?.badgeClass).toBe('badge-due-today');
    });

    it('Cenário BDD 3: deve retornar status due_soon para despesas que vencem em 1 a 3 dias', () => {
      // Vence amanhã (+1 dia: 13/09/2026)
      const tomorrow = getExpenseDueDateInfo('2026-09-13', false, false, fixedToday);
      expect(tomorrow?.status).toBe('due_soon');
      expect(tomorrow?.daysDiff).toBe(1);
      expect(tomorrow?.label).toBe('Vence amanhã');
      expect(tomorrow?.badgeClass).toBe('badge-due-soon');

      // Vence em 2 dias (+2 dias: 14/09/2026)
      const in2Days = getExpenseDueDateInfo('2026-09-14', false, false, fixedToday);
      expect(in2Days?.status).toBe('due_soon');
      expect(in2Days?.daysDiff).toBe(2);
      expect(in2Days?.label).toBe('Vence em 2 dias');

      // Vence em 3 dias (+3 dias: 15/09/2026)
      const in3Days = getExpenseDueDateInfo('2026-09-15', false, false, fixedToday);
      expect(in3Days?.status).toBe('due_soon');
      expect(in3Days?.daysDiff).toBe(3);
      expect(in3Days?.label).toBe('Vence em 3 dias');
    });

    it('Cenário BDD 4: deve retornar status normal para despesas futuras com mais de 3 dias', () => {
      const future = getExpenseDueDateInfo('2026-09-25', false, false, fixedToday);
      expect(future?.status).toBe('normal');
      expect(future?.daysDiff).toBe(13);
      expect(future?.label).toBe('');
    });

    it('Cenário BDD 5: despesas pagas (isPaid = true) não devem gerar alerta de vencimento/atraso', () => {
      const paidOverdue = getExpenseDueDateInfo('2026-09-01', true, false, fixedToday);
      expect(paidOverdue?.status).toBe('paid');
      expect(paidOverdue?.label).toBe('Paga');
      expect(paidOverdue?.badgeClass).toBe('badge-paid');
    });

    it('Cenário BDD 6: rendas extras (isIncome = true) ou despesas sem vencimento devem retornar nulo', () => {
      expect(getExpenseDueDateInfo('2026-09-01', false, true, fixedToday)).toBeNull();
      expect(getExpenseDueDateInfo('', false, false, fixedToday)).toBeNull();
      expect(getExpenseDueDateInfo(null, false, false, fixedToday)).toBeNull();
    });

    it('Cenário BDD 7: deve calcular corretamente através de viradas de mês', () => {
      const endOfAugust = new Date(2026, 7, 31, 12, 0, 0); // 31 de Agosto de 2026
      const inSeptember = getExpenseDueDateInfo('2026-09-02', false, false, endOfAugust);
      expect(inSeptember?.status).toBe('due_soon');
      expect(inSeptember?.daysDiff).toBe(2);
      expect(inSeptember?.label).toBe('Vence em 2 dias');
    });
  });
});

