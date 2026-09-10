export type AsaasWebhookEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_INACTIVATED'
  | 'SUBSCRIPTION_DELETED';

export interface AsaasPaymentPayload {
  id: string;
  customer: string;
  subscription?: string;
  installment?: string;
  value: number;
  netValue?: number;
  billingType?: string;
  status?: string;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  externalReference?: string;
  description?: string;
}

export interface AsaasSubscriptionWebhookData {
  id: string;
  customer: string;
  status: string;
  value?: number;
  nextDueDate?: string;
  cycle?: string;
  description?: string;
  externalReference?: string;
}

export interface AsaasWebhookPayload {
  id?: string;
  event: AsaasWebhookEventType;
  dateCreated?: string;
  payment?: AsaasPaymentPayload;
  subscription?: AsaasSubscriptionWebhookData;
}

export interface ProcessWebhookResult {
  success: boolean;
  statusCode: number;
  message: string;
  eventId?: string;
  userId?: string;
  actionTaken?: string;
  alreadyProcessed?: boolean;
}
