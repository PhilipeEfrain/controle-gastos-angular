export type FortnightNumber = 1 | 2;

export interface Expense {
  id?: string;
  descricao: string;
  valor: number;
  quinzena: FortnightNumber;
  status_pagamento: boolean;
  codigo_comprovante?: string;
  categoria: string;
  recorrente?: boolean;
  data_vencimento?: string;
  parcela_atual?: number;
  total_parcelas?: number;
  grupo_parcela_id?: string;
  createdAt?: string;
}

export interface MonthlyCycle {
  id?: string;
  mesAno: string; // Formato YYYY-MM (ex: "2025-03")
  renda_quinzena_1: number;
  renda_quinzena_2: number;
  total_renda: number;
  total_gastos: number;
  saldo_final: number;
  updatedAt?: string;
}

export interface FortnightSummary {
  quinzena: FortnightNumber;
  label: string;
  renda: number;
  totalGastos: number;
  saldo: number;
  isDeficit: boolean;
  percentualGasto: number;
}

export interface MonthBalanceSummary {
  totalRenda: number;
  totalGastos: number;
  saldoFinal: number;
  temDeficitGlobal: boolean;
  q1: FortnightSummary;
  q2: FortnightSummary;
  q1CobreQ2: boolean;
}

export interface AnnualTax {
  id?: string;
  titulo: string;
  data_vencimento: string; // YYYY-MM-DD
  valor_orcado: number;
  valor_pago: number;
  status: 'Pendente' | 'Pago';
  data_pagamento?: string;
  ano_referencia?: number;
}
