export type FortnightNumber = 1 | 2;

export interface Expense {
  id?: string;
  descricao: string;
  valor: number;
  quinzena: FortnightNumber;
  status_pagamento: boolean;
  tipo?: 'despesa' | 'renda_extra';
  codigo_comprovante?: string;
  categoria: string;
  recorrente?: boolean;
  recorrente_id?: string;
  data_vencimento?: string;
  parcela_atual?: number;
  total_parcelas?: number;
  grupo_parcela_id?: string;
  createdAt?: string;
}

export interface RecurringExpense {
  id?: string;
  descricao: string;
  valor: number;
  quinzena: FortnightNumber;
  categoria: string;
  data_vencimento?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SalaryRegime = 'quinzenal' | 'mensal_q1' | 'mensal_q2' | 'divisao_50_50' | 'mensal_unico';

export interface MonthlyCycle {
  id?: string;
  mesAno: string; // Formato YYYY-MM (ex: "2025-03")
  renda_quinzena_1: number;
  renda_quinzena_2: number;
  total_renda: number;
  total_gastos: number;
  saldo_final: number;
  regime_salarial?: SalaryRegime;
  dia_pagamento?: number | string; // Ex: 5, 10, 20 ou '5_dia_util'
  descricao_dia_pagamento?: string; // Ex: '5º dia útil', 'Dia 10', 'Dia 20'
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

export interface TravelExpenseItem {
  id?: string;
  descricao: string;
  valor: number;
  categoria: string;
  pago_por?: string;
  dividir: boolean; // se true, divide pelo número de participantes; se false, gasto individual
  createdAt?: string;
}

export interface TravelTrip {
  id?: string;
  titulo: string;
  destino?: string;
  data_inicio?: string;
  data_fim?: string;
  quantidade_participantes: number;
  despesas: TravelExpenseItem[];
  total_gastos: number;
  valor_por_pessoa: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstallmentParcel {
  id: string;
  mesAno: string;
  parcela_atual: number;
  total_parcelas: number;
  valor: number;
  status_pagamento: boolean;
  quinzena: FortnightNumber;
  data_vencimento?: string;
}

export interface InstallmentGroup {
  grupo_parcela_id: string;
  descricao: string;
  categoria: string;
  valor_parcela: number;
  total_parcelas: number;
  parcelas_pagas: number;
  total_pago: number;
  saldo_restante: number;
  valor_total: number;
  percentual_concluido: number;
  proximo_vencimento?: string;
  parcelas: InstallmentParcel[];
}


