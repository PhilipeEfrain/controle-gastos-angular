import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  parseBRL,
  formatPercent,
  maskCpfCnpj,
  maskCardNumber,
  maskCardExpiry,
  maskCardCvv,
  maskCardHolderName,
  isValidCpfCnpj
} from './formatters';

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

    it('deve formatar valores negativos mantendo o sinal e o símbolo BRL coesos', () => {
      const negativeFormatted = formatBRL(-1500.5);
      expect(negativeFormatted).toContain('1.500,50');
      expect(negativeFormatted).toMatch(/-.*R\$.*1\.500,50/);
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

  describe('maskCpfCnpj', () => {
    it('deve formatar CPF com pontuação correta', () => {
      expect(maskCpfCnpj('52998224725')).toBe('529.982.247-25');
      expect(maskCpfCnpj('529.982.247-25')).toBe('529.982.247-25');
      expect(maskCpfCnpj('529982247')).toBe('529.982.247');
    });

    it('deve formatar CNPJ quando ultrapassar 11 dígitos', () => {
      expect(maskCpfCnpj('12345678000199')).toBe('12.345.678/0001-99');
    });

    it('deve lidar com valores vazios', () => {
      expect(maskCpfCnpj('')).toBe('');
      expect(maskCpfCnpj(null)).toBe('');
    });
  });

  describe('maskCardNumber', () => {
    it('deve agrupar os números do cartão de 4 em 4 dígitos', () => {
      expect(maskCardNumber('5555555555555555')).toBe('5555 5555 5555 5555');
      expect(maskCardNumber('4012001037141112')).toBe('4012 0010 3714 1112');
    });

    it('deve ignorar caracteres não numéricos', () => {
      expect(maskCardNumber('5555-5555-5555-5555')).toBe('5555 5555 5555 5555');
    });

    it('deve limitar a 19 dígitos numéricos', () => {
      const longCard = '123456781234567899999999';
      expect(maskCardNumber(longCard)).toBe('1234 5678 1234 5678 999');
    });
  });

  describe('maskCardExpiry', () => {
    it('deve formatar validade no formato MM/AA', () => {
      expect(maskCardExpiry('1228')).toBe('12/28');
      expect(maskCardExpiry('0829')).toBe('08/29');
    });

    it('deve manter até 2 dígitos sem barra', () => {
      expect(maskCardExpiry('12')).toBe('12');
      expect(maskCardExpiry('1')).toBe('1');
    });

    it('deve ignorar caracteres não numéricos e limitar a 4 dígitos', () => {
      expect(maskCardExpiry('12/2899')).toBe('12/28');
    });
  });

  describe('maskCardCvv', () => {
    it('deve manter apenas números e limitar a 4 dígitos', () => {
      expect(maskCardCvv('123')).toBe('123');
      expect(maskCardCvv('1234')).toBe('1234');
      expect(maskCardCvv('12345')).toBe('1234');
      expect(maskCardCvv('abc12#')).toBe('12');
    });
  });

  describe('maskCardHolderName', () => {
    it('deve converter para maiúsculas e remover números e símbolos', () => {
      expect(maskCardHolderName('Philipe Gonzalez 123!')).toBe('PHILIPE GONZALEZ ');
      expect(maskCardHolderName('José da Silva')).toBe('JOSÉ DA SILVA');
    });
  });

  describe('isValidCpfCnpj', () => {
    it('deve validar CPFs válidos com ou sem máscara', () => {
      expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
      expect(isValidCpfCnpj('52998224725')).toBe(true);
    });

    it('deve validar CNPJs válidos com ou sem máscara', () => {
      expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
      expect(isValidCpfCnpj('11222333000181')).toBe(true);
    });

    it('deve rejeitar CPFs com dígitos repetidos (ex: 111.111.111-11)', () => {
      expect(isValidCpfCnpj('111.111.111-11')).toBe(false);
      expect(isValidCpfCnpj('000.000.000-00')).toBe(false);
    });

    it('deve rejeitar CPFs com dígitos verificadores incorretos', () => {
      expect(isValidCpfCnpj('123.456.789-00')).toBe(false);
      expect(isValidCpfCnpj('529.982.247-99')).toBe(false);
    });

    it('deve rejeitar documentos de tamanho incorreto ou vazios', () => {
      expect(isValidCpfCnpj('12345')).toBe(false);
      expect(isValidCpfCnpj('')).toBe(false);
      expect(isValidCpfCnpj(null)).toBe(false);
      expect(isValidCpfCnpj(undefined)).toBe(false);
    });
  });
});

