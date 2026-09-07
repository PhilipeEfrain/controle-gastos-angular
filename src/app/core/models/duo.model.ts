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
