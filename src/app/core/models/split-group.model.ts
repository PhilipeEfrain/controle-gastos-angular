export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface SplitParticipant {
  id: string;
  name: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  isRegistered?: boolean;
  userId?: string | null;
  email?: string | null;
}

export interface SplitExpenseShare {
  participantId: string;
  amount: number;
}

export interface SplitExpense {
  id?: string;
  groupId: string;
  description: string;
  amount: number;
  paidByParticipantId: string;
  splitType: 'equal' | 'custom';
  shares: SplitExpenseShare[];
  date: string;
  createdAt?: string;
  createdBy?: string;
}

export interface DebtSettlement {
  fromParticipantId: string;
  fromParticipantName: string;
  toParticipantId: string;
  toParticipantName: string;
  toPixKey?: string;
  toPixKeyType?: PixKeyType;
  amount: number;
}

export interface SplitParticipantBalance {
  participantId: string;
  participantName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positivo = a receber, negativo = a pagar
  pixKey?: string;
  pixKeyType?: PixKeyType;
}

export interface SplitGroupSummary {
  totalAmount: number;
  expensesCount: number;
  balances: SplitParticipantBalance[];
  settlements: DebtSettlement[];
}

export interface SplitGroup {
  id?: string;
  title: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  viewToken: string;
  status: 'active' | 'settled';
  participants: SplitParticipant[];
  totalExpenses?: number;
  createdAt?: string;
  updatedAt?: string;
  settledAt?: string;
}
