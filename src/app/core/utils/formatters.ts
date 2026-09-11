import { isCPF, isCNPJ } from 'validation-br';

/**
 * Formata um número para Real Brasileiro (BRL)
 * Ex: 1234.56 -> "R$ 1.234,56"
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$\u00A00,00';
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  // Garante espaços sem quebra (non-breaking space \u00A0) em toda a formatação monetária
  return formatted.replace(/\s/g, '\u00A0');
}

/**
 * Converte uma string formatada em Real (BRL) para número float
 * Ex: "R$ 1.234,56" -> 1234.56
 */
export function parseBRL(formatted: string | null | undefined): number {
  if (!formatted) {
    return 0;
  }

  // Remove símbolos não numéricos exceto vírgula e ponto
  const cleaned = formatted
    .replace(/[^\d,-]/g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formata um valor percentual
 * Ex: 75.5 -> "75,5%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/**
 * Aplica máscara estrita de CPF (000.000.000-00), limitando a 11 dígitos numéricos
 */
export function maskCpf(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Aplica máscara dinâmica de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
 */
export function maskCpfCnpj(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Aplica máscara no número do cartão de crédito (grupos de 4 dígitos)
 * Ex: "5555555555555555" -> "5555 5555 5555 5555"
 */
export function maskCardNumber(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Aplica máscara na data de expiração do cartão no padrão MM/AA
 * Ex: "1228" -> "12/28"
 */
export function maskCardExpiry(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

/**
 * Aplica máscara no código de segurança CVV (apenas números, até 4 dígitos)
 */
export function maskCardCvv(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 4);
}

/**
 * Sanitiza e formata o nome do titular (maiúsculas e apenas letras/espaços)
 */
export function maskCardHolderName(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').toUpperCase();
}

/**
 * Validador estrito exclusivo para CPF através do algoritmo oficial de Módulo 11 (validation-br).
 * Rejeita qualquer CNPJ ou documento com comprimento diferente de 11 dígitos.
 */
export function isValidCpf(document: string | null | undefined): boolean {
  if (!document) return false;
  const clean = document.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  return isCPF(clean);
}

/**
 * Validador para formulários de cadastro e checkout: restrito estritamente a CPF (rejeita CNPJ)
 */
export function isValidCpfCnpj(document: string | null | undefined): boolean {
  return isValidCpf(document);
}

/**
 * Aplica máscara de moeda BRL em tempo real durante a digitação
 * Ex: "1" -> "0,01" | "1500" -> "15,00" | "150000" -> "1.500,00"
 */
export function maskCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const str = typeof value === 'number' ? Math.round(value * 100).toString() : value.toString();
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';

  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Converte string mascarada de moeda para número decimal float
 * Ex: "1.500,50" -> 1500.5
 */
export function parseCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const digits = value.toString().replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}


