import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || "";

// Wompi webhook event types
interface WompiWebhookPayload {
  event: string;
  data: {
    transaction: {
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
        extra?: Record<string, unknown>;
        installments?: number;
      };
      status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
      status_message: string | null;
      payment_link_id?: string;
    };
  };
  sent_at: string;
  timestamp: number;
  signature: {
    checksum: string;
    properties: string[];
  };
  environment: "test" | "prod";
}

function verifyWompiChecksum(payload: WompiWebhookPayload): boolean {
  try {
    const { signature, data, timestamp } = payload;
    const properties = signature.properties;

    // Build the string to hash based on properties
    const values: string[] = [];
    for (const prop of properties) {
      const parts = prop.split(".");
      let value: unknown = data;
      for (const part of parts) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        values.push(String(value));
      }
    }

    // Add timestamp and secret
    values.push(String(timestamp));
    values.push(WOMPI_EVENTS_SECRET);

    const stringToHash = values.join("");
    const computedChecksum = crypto
      .createHash("sha256")
      .update(stringToHash)
      .digest("hex");

    return computedChecksum === signature.checksum;
  } catch (error) {
    console.error("Error verifying Wompi checksum:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload: WompiWebhookPayload = JSON.parse(rawBody);

    console.log("Received Wompi webhook:", {
      event: payload.event,
      transactionId: payload.data?.transaction?.id,
      status: payload.data?.transaction?.status,
      paymentLinkId: payload.data?.transaction?.payment_link_id,
    });

    // Verify checksum if secret is configured
    if (WOMPI_EVENTS_SECRET && !verifyWompiChecksum(payload)) {
      console.error("Invalid Wompi webhook checksum");
      return NextResponse.json(
        { error: "Invalid checksum" },
        { status: 401 }
      );
    }

    // Only process transaction events
    if (payload.event !== "transaction.updated") {
      console.log("Ignoring non-transaction event:", payload.event);
      return NextResponse.json({ message: "Event ignored" });
    }

    const transaction = payload.data.transaction;
    const eventId = `wompi_${transaction.id}_${payload.timestamp}`;

    // Check if we already processed this event
    const existingLog = await prisma.webhookLog.findUnique({
      where: { eventId },
    });

    if (existingLog) {
      console.log("Event already processed:", eventId);
      return NextResponse.json({ message: "Event already processed" });
    }

    // Log the webhook event
    await prisma.webhookLog.create({
      data: {
        provider: "WOMPI",
        eventId,
        eventType: payload.event,
        paymentId: transaction.id,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });

    // Find the payment link by payment_link_id from Wompi
    let link = null;

    if (transaction.payment_link_id) {
      link = await prisma.paymentLink.findUnique({
        where: { providerLinkId: transaction.payment_link_id },
      });
    }

    // Fallback: try to find by reference if it matches our link ID pattern
    if (!link && transaction.reference) {
      link = await prisma.paymentLink.findFirst({
        where: {
          OR: [
            { providerLinkId: transaction.reference },
            { id: transaction.reference },
          ],
          provider: "WOMPI",
        },
      });
    }

    if (!link) {
      console.log("Payment link not found for transaction:", transaction.id);
      return NextResponse.json({ message: "Link not found" });
    }

    // Update the payment link based on transaction status
    switch (transaction.status) {
      case "APPROVED":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "PAID",
            transactionId: transaction.id,
            paymentMethod: transaction.payment_method_type,
            payerEmail: transaction.customer_email,
            paidAt: transaction.finalized_at ? new Date(transaction.finalized_at) : new Date(),
          },
        });
        console.log("Payment link marked as PAID:", link.id);
        break;

      case "DECLINED":
      case "ERROR":
        // Keep link active for retry
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "ACTIVE",
          },
        });
        console.log("Payment declined/error, link remains ACTIVE:", link.id);
        break;

      case "VOIDED":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "ACTIVE",
            transactionId: null,
            paymentMethod: null,
            payerEmail: null,
            paidAt: null,
          },
        });
        console.log("Payment voided, link marked as ACTIVE:", link.id);
        break;

      case "PENDING":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "PROCESSING",
            transactionId: transaction.id,
          },
        });
        console.log("Payment pending, link marked as PROCESSING:", link.id);
        break;

      default:
        console.log("Unhandled transaction status:", transaction.status);
    }

    // Mark webhook as processed
    await prisma.webhookLog.update({
      where: { eventId },
      data: { processed: true },
    });

    return NextResponse.json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing Wompi webhook:", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
}
