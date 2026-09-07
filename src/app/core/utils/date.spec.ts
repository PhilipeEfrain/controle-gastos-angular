import { describe, it, expect } from 'vitest';
import { getCurrentYearMonth, getFortnightFromDay, formatYearMonthLabel } from './date';

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
});
