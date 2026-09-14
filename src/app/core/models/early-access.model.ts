export interface EarlyAccessConfig {
  registrationsOpen: boolean;
  maxBetaUsers: number;
  totalRegisteredUsers?: number;
  message?: string;
  updatedAt?: string;
}

export interface WaitlistLead {
  id?: string;
  email: string;
  source?: string;
  createdAt: string;
}
