import {
  BoldCreateLinkRequest,
  BoldCreateLinkResponse,
  BoldLinkStatusResponse,
  BoldPaymentMethodsResponse,
} from "@/types";

const BOLD_API_URL = process.env.BOLD_API_URL || "https://integrations.api.bold.co";
const BOLD_API_KEY = process.env.BOLD_API_KEY || "";

async function boldFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BOLD_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `x-api-key ${BOLD_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Bold API Error:", error);
    throw new Error(`Bold API error: ${response.status}`);
  }

  return response.json();
}

export async function getPaymentMethods(): Promise<BoldPaymentMethodsResponse> {
  return boldFetch<BoldPaymentMethodsResponse>("/online/link/v1/payment_methods");
}

export async function createPaymentLink(
  data: BoldCreateLinkRequest
): Promise<BoldCreateLinkResponse> {
  return boldFetch<BoldCreateLinkResponse>("/online/link/v1", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPaymentLinkStatus(
  linkId: string
): Promise<BoldLinkStatusResponse> {
  return boldFetch<BoldLinkStatusResponse>(`/online/link/v1/${linkId}`);
}

export function convertToNanoseconds(date: Date): number {
  return Math.floor(date.getTime() * 1e6);
}

export function convertFromNanoseconds(nanoseconds: number): Date {
  return new Date(Math.floor(nanoseconds / 1e6));
}

export interface CreateLinkParams {
  title: string;
  description?: string;
  amount: number;
  amountType: "OPEN" | "CLOSE";
  logoUrl?: string;
  expirationDate?: Date;
  callbackUrl?: string;
  paymentMethods?: string[];
  payerEmail?: string;
}

export async function createBoldLink(params: CreateLinkParams) {
  const request: BoldCreateLinkRequest = {
    amount_type: params.amountType,
  };

  if (params.amountType === "CLOSE" && params.amount > 0) {
    request.amount = {
      currency: "COP",
      total_amount: params.amount,
    };
  }

  if (params.description) {
    request.description = params.description.substring(0, 100);
  }

  if (params.expirationDate) {
    request.expiration_date = convertToNanoseconds(params.expirationDate);
  }

  if (params.logoUrl) {
    request.image_url = params.logoUrl;
  }

  if (params.callbackUrl) {
    request.callback_url = params.callbackUrl;
  }

  if (params.paymentMethods && params.paymentMethods.length > 0) {
    request.payment_methods = params.paymentMethods;
  }

  if (params.payerEmail) {
    request.payer_email = params.payerEmail;
  }

  return createPaymentLink(request);
}
