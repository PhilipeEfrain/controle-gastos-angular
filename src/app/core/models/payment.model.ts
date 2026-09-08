import { PlanType, PlanStatus } from './user.model';

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaymentBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export interface PlanPricing {
  plan: PlanType;
  name: string;
  badge?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyEquivalentMonthly: number;
  discountPercentage: number;
  features: string[];
}

export interface AsaasCustomerData {
  id?: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  addressNumber?: string;
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface AsaasSubscriptionPayload {
  customer: string;
  billingType: PaymentBillingType;
  value: number;
  nextDueDate: string;
  cycle: BillingCycle;
  description: string;
  creditCard?: CreditCardData;
  creditCardHolderInfo?: CreditCardHolderInfo;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  value: number;
  cycle: BillingCycle;
  nextDueDate: string;
  billingType: PaymentBillingType;
  dateCreated: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface AsaasPaymentData {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  netValue: number;
  status: 'CONFIRMED' | 'RECEIVED' | 'PENDING' | 'OVERDUE' | 'REFUNDED';
  billingType: PaymentBillingType;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  externalReference?: string;
}

export type AsaasWebhookEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED';

export interface AsaasWebhookPayload {
  event: AsaasWebhookEventType;
  payment: AsaasPaymentData;
}

export type AsaasEnvironment = 'sandbox' | 'production';

export interface AsaasConfig {
  environment: AsaasEnvironment;
  apiKey: string;
  webhookSecret?: string;
  walletId?: string;
  notificationEmail?: string;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'error';
  lastTestMessage?: string;
  updatedAt?: string;
}

