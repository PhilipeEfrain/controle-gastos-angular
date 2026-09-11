import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  parseBRL,
  formatPercent,
  maskCpf,
  maskCpfCnpj,
  maskCardNumber,
  maskCardExpiry,
  maskCardCvv,
  maskCardHolderName,
  isValidCpf,
  isValidCpfCnpj,
  maskCurrency,
  parseCurrency
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

  describe('maskCpf', () => {
    it('deve formatar CPF com pontuação correta', () => {
      expect(maskCpf('52998224725')).toBe('529.982.247-25');
      expect(maskCpf('529.982.247-25')).toBe('529.982.247-25');
      expect(maskCpf('529982247')).toBe('529.982.247');
    });

    it('deve limitar estritamente a 11 dígitos numéricos, impedindo digitação de CNPJ', () => {
      expect(maskCpf('12345678000199')).toBe('123.456.780-00');
    });

    it('deve lidar com valores vazios', () => {
      expect(maskCpf('')).toBe('');
      expect(maskCpf(null)).toBe('');
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

  describe('isValidCpf', () => {
    it('deve validar CPFs matematicamente válidos', () => {
      expect(isValidCpf('529.982.247-25')).toBe(true);
      expect(isValidCpf('52998224725')).toBe(true);
    });

    it('deve REJEITAR CNPJs mesmo que sejam válidos (restrição exclusiva a pessoa física)', () => {
      expect(isValidCpf('11.222.333/0001-81')).toBe(false);
      expect(isValidCpf('11222333000181')).toBe(false);
    });

    it('deve rejeitar CPFs com dígitos repetidos (ex: 111.111.111-11)', () => {
      expect(isValidCpf('111.111.111-11')).toBe(false);
      expect(isValidCpf('000.000.000-00')).toBe(false);
    });

    it('deve rejeitar CPFs com dígitos verificadores incorretos', () => {
      expect(isValidCpf('123.456.789-00')).toBe(false);
      expect(isValidCpf('529.982.247-99')).toBe(false);
    });

    it('deve rejeitar documentos de tamanho incorreto ou vazios', () => {
      expect(isValidCpf('12345')).toBe(false);
      expect(isValidCpf('')).toBe(false);
      expect(isValidCpf(null)).toBe(false);
      expect(isValidCpf(undefined)).toBe(false);
    });
  });

  describe('isValidCpfCnpj', () => {
    it('deve aceitar CPF válido', () => {
      expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    });

    it('deve rejeitar CNPJ (bloqueio no cadastro)', () => {
      expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(false);
    });
  });

  describe('maskCurrency', () => {
    it('deve formatar valores numéricos em BRL com centavos', () => {
      expect(maskCurrency(1500.5)).toContain('1.500,50');
      expect(maskCurrency(0)).toBe('0,00');
      expect(maskCurrency(9.9)).toBe('9,90');
    });

    it('deve formatar digitação de dígitos inteiros com deslocamento de centavos', () => {
      expect(maskCurrency('1')).toBe('0,01');
      expect(maskCurrency('15')).toBe('0,15');
      expect(maskCurrency('1500')).toBe('15,00');
      expect(maskCurrency('150050')).toBe('1.500,50');
      expect(maskCurrency('1500000')).toBe('15.000,00');
    });

    it('deve retornar string vazia para valores nulos ou vazios', () => {
      expect(maskCurrency(null)).toBe('');
      expect(maskCurrency(undefined)).toBe('');
      expect(maskCurrency('')).toBe('');
    });
  });

  describe('parseCurrency', () => {
    it('deve converter string mascarada para float numérico', () => {
      expect(parseCurrency('1.500,50')).toBe(1500.5);
      expect(parseCurrency('0,01')).toBe(0.01);
      expect(parseCurrency('15,00')).toBe(15);
      expect(parseCurrency('0,00')).toBe(0);
    });

    it('deve retornar 0 para valores vazios ou inválidos', () => {
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency(null)).toBe(0);
    });

    it('deve preservar números diretos', () => {
      expect(parseCurrency(250.75)).toBe(250.75);
    });
  });
});

