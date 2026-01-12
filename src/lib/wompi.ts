import crypto from "crypto";

const WOMPI_API_URL = process.env.WOMPI_API_URL || "https://production.wompi.co/v1";
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || "";
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || "";
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || "";
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || "";

// Types
export interface WompiMerchantResponse {
  data: {
    id: number;
    name: string;
    email: string;
    contact_name: string;
    phone_number: string;
    active: boolean;
    logo_url: string | null;
    legal_name: string;
    legal_id_type: string;
    legal_id: string;
    public_key: string;
    accepted_payment_methods: string[];
    fraud_javascript_key: string | null;
    fraud_groups: unknown[];
    accepted_currencies: string[];
    presigned_acceptance: {
      acceptance_token: string;
      permalink: string;
      type: string;
    };
    presigned_personal_data_auth: {
      acceptance_token: string;
      permalink: string;
      type: string;
    };
  };
}

export interface WompiTransactionRequest {
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  reference: string;
  payment_method?: {
    type: string;
    installments?: number;
    token?: string;
    phone_number?: string;
    user_type?: number | string;
    user_legal_id_type?: string;
    user_legal_id?: string;
    financial_institution_code?: string;
    payment_description?: string;
  };
  redirect_url?: string;
  acceptance_token?: string;
  accept_personal_auth?: string;
  expiration_time?: string; // ISO 8601 format
}

export interface WompiTransactionResponse {
  data: {
    id: string;
    created_at: string;
    finalized_at: string | null;
    amount_in_cents: number;
    reference: string;
    customer_email: string;
    currency: string;
    payment_method_type: string;
    payment_method: {
      type: string;
      extra?: {
        async_payment_url?: string;
        external_identifier?: string;
      };
      installments?: number;
    };
    status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
    status_message: string | null;
    redirect_url: string | null;
    merchant: {
      name: string;
      legal_name: string;
      contact_name: string;
      phone_number: string;
      logo_url: string | null;
    };
  };
  meta?: Record<string, unknown>;
}

export interface WompiPaymentLinkRequest {
  name: string;
  description: string;
  single_use: boolean;
  collect_shipping: boolean;
  currency: string;
  amount_in_cents: number;
  expires_at?: string; // ISO 8601 format
  redirect_url?: string;
  image_url?: string;
}

export interface WompiPaymentLinkResponse {
  data: {
    id: string;
    name: string;
    description: string;
    single_use: boolean;
    collect_shipping: boolean;
    currency: string;
    amount_in_cents: number;
    expires_at: string | null;
    redirect_url: string | null;
    image_url: string | null;
    active: boolean;
    url: string;
    created_at: string;
    sku: string | null;
  };
}

// Helper functions
async function wompiPublicFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${WOMPI_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Wompi API Error:", data);
    throw new Error(data.error?.message || `Wompi API error: ${response.status}`);
  }

  return data;
}

async function wompiPrivateFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  console.log("Wompi API Request:", {
    url: `${WOMPI_API_URL}${endpoint}`,
    method: options.method || "GET",
    hasPrivateKey: !!WOMPI_PRIVATE_KEY,
  });

  const response = await fetch(`${WOMPI_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Wompi API Error:", JSON.stringify(data, null, 2));
    // Wompi error structure can vary
    const errorMessage =
      data.error?.message ||
      data.error?.reason ||
      data.message ||
      (data.error && typeof data.error === "string" ? data.error : null) ||
      `Wompi API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

// Get merchant info and acceptance tokens
export async function getMerchantInfo(): Promise<WompiMerchantResponse> {
  return wompiPublicFetch<WompiMerchantResponse>(`/merchants/${WOMPI_PUBLIC_KEY}`);
}

// Generate integrity signature for transaction
export function generateIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string
): string {
  const data = `${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Create a payment link using Wompi's Payment Link API
export async function createWompiPaymentLink(params: {
  name: string;
  description?: string;
  amount: number;
  expiresAt?: Date;
  redirectUrl?: string;
  imageUrl?: string;
}): Promise<WompiPaymentLinkResponse> {
  const request: WompiPaymentLinkRequest = {
    name: params.name,
    description: params.description || params.name,
    single_use: true,
    collect_shipping: false,
    currency: "COP",
    amount_in_cents: params.amount * 100, // Convert to cents
  };

  if (params.expiresAt) {
    request.expires_at = params.expiresAt.toISOString();
  }

  if (params.redirectUrl) {
    request.redirect_url = params.redirectUrl;
  }

  if (params.imageUrl) {
    request.image_url = params.imageUrl;
  }

  return wompiPrivateFetch<WompiPaymentLinkResponse>("/payment_links", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// Create a transaction (for direct payment)
export async function createWompiTransaction(params: {
  amount: number;
  customerEmail: string;
  reference: string;
  redirectUrl?: string;
  paymentMethod?: WompiTransactionRequest["payment_method"];
}): Promise<WompiTransactionResponse> {
  // Get acceptance tokens
  const merchantInfo = await getMerchantInfo();

  const request: WompiTransactionRequest = {
    amount_in_cents: params.amount * 100, // Convert to cents
    currency: "COP",
    customer_email: params.customerEmail,
    reference: params.reference,
    acceptance_token: merchantInfo.data.presigned_acceptance.acceptance_token,
    accept_personal_auth: merchantInfo.data.presigned_personal_data_auth.acceptance_token,
  };

  if (params.redirectUrl) {
    request.redirect_url = params.redirectUrl;
  }

  if (params.paymentMethod) {
    request.payment_method = params.paymentMethod;
  }

  // Generate integrity signature
  const signature = generateIntegritySignature(
    params.reference,
    request.amount_in_cents,
    request.currency
  );

  return wompiPrivateFetch<WompiTransactionResponse>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      signature,
    }),
  });
}

// Get transaction status
export async function getWompiTransactionStatus(transactionId: string): Promise<WompiTransactionResponse> {
  return wompiPrivateFetch<WompiTransactionResponse>(`/transactions/${transactionId}`);
}

// Get payment link status
export async function getWompiPaymentLinkStatus(linkId: string): Promise<WompiPaymentLinkResponse> {
  return wompiPrivateFetch<WompiPaymentLinkResponse>(`/payment_links/${linkId}`);
}

// Get PSE financial institutions
export async function getPSEInstitutions(): Promise<{
  data: Array<{
    financial_institution_code: string;
    financial_institution_name: string;
  }>;
}> {
  return wompiPublicFetch(`/pse/financial_institutions`);
}

// Verify webhook signature
export function verifyWompiWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  const data = `${timestamp}${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", WOMPI_EVENTS_SECRET)
    .update(data)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

// Map Wompi status to our LinkStatus
export function mapWompiStatusToLinkStatus(
  status: WompiTransactionResponse["data"]["status"]
): "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED" {
  switch (status) {
    case "APPROVED":
      return "PAID";
    case "PENDING":
      return "PROCESSING";
    case "DECLINED":
    case "VOIDED":
    case "ERROR":
      return "EXPIRED";
    default:
      return "ACTIVE";
  }
}

// Create link params interface
export interface CreateWompiLinkParams {
  title: string;
  description?: string;
  amount: number;
  expirationDate?: Date;
  redirectUrl?: string;
  logoUrl?: string;
}

// Main function to create a Wompi payment link
export async function createWompiLink(params: CreateWompiLinkParams): Promise<{
  linkId: string;
  url: string;
}> {
  const response = await createWompiPaymentLink({
    name: params.title,
    description: params.description,
    amount: params.amount,
    expiresAt: params.expirationDate,
    redirectUrl: params.redirectUrl,
    imageUrl: params.logoUrl,
  });

  console.log("Full Wompi API Data Response:", JSON.stringify(response.data, null, 2));

  // Fallback URL if not provided by API
  const linkId = response.data.id;
  const url = response.data.url || `https://checkout.wompi.co/l/${linkId}`;

  return {
    linkId,
    url,
  };
}
