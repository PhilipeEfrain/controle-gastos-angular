/**
 * Formata um número para Real Brasileiro (BRL)
 * Ex: 1234.56 -> "R$ 1.234,56"
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
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
