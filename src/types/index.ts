import { Role, LinkStatus, PaymentProvider } from "@prisma/client";

export type { Role, LinkStatus, PaymentProvider };

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreatePaymentLinkInput {
  title: string;
  description?: string;
  amount: number;
  amountUsd?: number;
  amountType?: "OPEN" | "CLOSE";
  logoUrl?: string;
  expirationDate?: Date;
  callbackUrl?: string;
  paymentMethods?: string[];
  provider?: PaymentProvider;
}

export interface UpdatePaymentLinkInput {
  title?: string;
  description?: string;
  amount?: number;
  logoUrl?: string;
  expirationDate?: Date;
  callbackUrl?: string;
  paymentMethods?: string[];
}

// Bold API Types
export interface BoldCreateLinkRequest {
  amount_type: "OPEN" | "CLOSE";
  amount?: {
    currency: string;
    total_amount: number;
    taxes?: Array<{
      type: string;
      base: number;
      value: number;
    }>;
    tip_amount?: number;
  };
  description?: string;
  expiration_date?: number;
  callback_url?: string;
  payment_methods?: string[];
  payer_email?: string;
  image_url?: string;
}

export interface BoldCreateLinkResponse {
  payload: {
    payment_link: string;
    url: string;
  };
  errors: string[];
}

export interface BoldLinkStatusResponse {
  api_version: number;
  id: string;
  total: number;
  subtotal: number;
  tip_amount: number;
  taxes: Array<{
    type: string;
    base: number;
    value: number;
  }>;
  status: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
  expiration_date: number | null;
  creation_date: number;
  description: string | null;
  payment_method: string;
  transaction_id: string | null;
  amount_type: "OPEN" | "CLOSE";
  is_sandbox: boolean;
}

export interface BoldPaymentMethodsResponse {
  payload: {
    payment_methods: Record<string, { max: number; min: number }>;
  };
  errors: string[];
}

// Webhook Types
export interface BoldWebhookPayload {
  id: string;
  type: "SALE_APPROVED" | "SALE_REJECTED" | "VOID_APPROVED" | "VOID_REJECTED";
  subject: string;
  source: string;
  spec_version: string;
  time: number;
  data: {
    payment_id: string;
    merchant_id: string;
    created_at: string;
    amount: {
      total: number;
      taxes: Array<{
        base: number;
        type: string;
        value: number;
      }>;
      tip: number;
    };
    card?: {
      capture_mode: string;
      franchise: string;
      cardholder_name: string;
      terminal_id: string;
    };
    user_id: string;
    payment_method: string;
    metadata: {
      reference: string;
    };
  };
  datacontenttype: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
