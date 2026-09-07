import { describe, it, expect } from 'vitest';
import { formatBRL, parseBRL, formatPercent } from './formatters';

describe('Formatters Utility', () => {
  describe('formatBRL', () => {
    it('deve formatar valores monetários em formato Real BRL', () => {
      expect(formatBRL(1234.56)).toContain('1.234,56');
      expect(formatBRL(0)).toContain('0,00');
    });

    it('deve tratar valores nulos ou undefined', () => {
      expect(formatBRL(null)).toContain('0,00');
      expect(formatBRL(undefined)).toContain('0,00');
    });
  });

  describe('parseBRL', () => {
    it('deve converter strings formatadas em número', () => {
      expect(parseBRL('R$ 1.234,56')).toBe(1234.56);
      expect(parseBRL('2.500,00')).toBe(2500);
    });

    it('deve retornar 0 para valores vazios ou inválidos', () => {
      expect(parseBRL('')).toBe(0);
      expect(parseBRL(null)).toBe(0);
    });
  });

  describe('formatPercent', () => {
    it('deve formatar números em percentual formatado', () => {
      expect(formatPercent(50.5)).toContain('50,5%');
      expect(formatPercent(0)).toContain('0,0%');
    });
  });
});
