import { describe, it, expect } from 'vitest';
import { getCurrentYearMonth, getFortnightFromDay, formatYearMonthLabel, parseFirestoreDate } from './date';

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
});
