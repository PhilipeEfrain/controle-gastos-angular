export type UserRole = 'admin' | 'user';
export type PlanType = 'free' | 'pro' | 'duo';
export type PlanStatus = 'active' | 'canceled' | 'past_due' | 'trial';

export interface UserPreferences {
  theme: 'dark' | 'light' | 'dark-blue';
  currency: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
  plan?: PlanType;
  planStatus?: PlanStatus;
  planExpiresAt?: string | null;
  gracePeriodExpiresAt?: string | null;
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
  preferences?: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

