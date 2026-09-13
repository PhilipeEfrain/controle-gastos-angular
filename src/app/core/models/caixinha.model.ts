export type CaixinhaMovimentacaoTipo = 'aporte' | 'resgate';

export interface Caixinha {
  id?: string;
  userId: string;
  saldo: number;
  meta?: number | null;
  nome?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CaixinhaMovimentacao {
  id?: string;
  caixinhaId: string;
  userId: string;
  tipo: CaixinhaMovimentacaoTipo;
  valor: number;
  data: string; // YYYY-MM-DD ou ISO
  observacao?: string;
  mesAnoDestino?: string; // YYYY-MM quando for resgate injetado no ciclo
  quinzenaDestino?: 1 | 2; // Quinzena 1 ou 2 que recebeu a renda
  createdAt?: string;
}
