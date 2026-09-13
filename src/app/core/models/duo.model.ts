export interface DuoGroup {
  id?: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  partnerId?: string | null;
  partnerEmail?: string | null;
  partnerName?: string | null;
  inviteCode: string;
  status: 'pending' | 'active' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface DuoSettlementSummary {
  ownerId: string;
  ownerName: string;
  ownerTotalPaid: number;
  partnerId: string;
  partnerName: string;
  partnerTotalPaid: number;
  totalShared: number;
  targetSharePerPerson: number;
  debtor: 'owner' | 'partner' | 'even';
  settlementAmount: number;
  message: string;
}

export interface DuoSharedExpense {
  id?: string;
  descricao: string;
  valorTotal: number;
  categoria?: string;
  quinzena: 1 | 2;
  mesAno: string; // YYYY-MM
  pagoPorId: string;
  pagoPorNome: string;
  tipoDivisao: '50_50' | 'personalizado' | '100_titular' | '100_parceiro';
  valorOwner: number; // cota-parte do titular
  valorPartner: number; // cota-parte do parceiro
  status_pagamento?: boolean;
  isParcelado?: boolean;
  parcelaAtual?: number;
  totalParcelas?: number;
  grupoParcelamentoId?: string;
  codigoComprovante?: string | null;
  observacao?: string;
  members: string[]; // [ownerId, partnerId]
  createdAt?: string;
  updatedAt?: string;
}

