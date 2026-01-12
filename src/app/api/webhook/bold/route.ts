import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { BoldWebhookPayload } from "@/types";

const BOLD_SECRET_KEY = process.env.BOLD_SECRET_KEY || "";

function verifySignature(body: string, signature: string): boolean {
  try {
    const encoded = Buffer.from(body).toString("base64");
    const hmac = crypto.createHmac("sha256", BOLD_SECRET_KEY);
    hmac.update(encoded);
    const computed = hmac.digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-bold-signature") || "";
    const rawBody = await request.text();

    // Verify signature (skip for test mode with empty secret)
    if (BOLD_SECRET_KEY && !verifySignature(rawBody, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: BoldWebhookPayload = JSON.parse(rawBody);

    console.log("Received webhook:", {
      type: payload.type,
      paymentId: payload.data.payment_id,
      reference: payload.data.metadata?.reference,
    });

    // Check if we already processed this event
    const existingLog = await prisma.webhookLog.findUnique({
      where: { eventId: payload.id },
    });

    if (existingLog) {
      console.log("Event already processed:", payload.id);
      return NextResponse.json({ message: "Event already processed" });
    }

    // Log the webhook event
    await prisma.webhookLog.create({
      data: {
        eventId: payload.id,
        eventType: payload.type,
        paymentId: payload.data.payment_id,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });

    // Get the payment link reference from metadata
    const reference = payload.data.metadata?.reference;

    if (!reference) {
      console.log("No reference in webhook payload");
      return NextResponse.json({ message: "No reference found" });
    }

    // Find the payment link by providerLinkId (reference starts with LNK_)
    let link;
    if (reference.startsWith("LNK_")) {
      link = await prisma.paymentLink.findUnique({
        where: { providerLinkId: reference },
      });
    }

    if (!link) {
      console.log("Payment link not found for reference:", reference);
      return NextResponse.json({ message: "Link not found" });
    }

    // Update the payment link based on event type
    switch (payload.type) {
      case "SALE_APPROVED":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "PAID",
            transactionId: payload.data.payment_id,
            paymentMethod: payload.data.payment_method,
            paidAt: new Date(),
          },
        });
        console.log("Payment link marked as PAID:", link.id);
        break;

      case "SALE_REJECTED":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "ACTIVE",
            transactionId: payload.data.payment_id,
          },
        });
        console.log("Payment link marked as ACTIVE (rejected):", link.id);
        break;

      case "VOID_APPROVED":
        await prisma.paymentLink.update({
          where: { id: link.id },
          data: {
            status: "ACTIVE",
            transactionId: null,
            paymentMethod: null,
            paidAt: null,
          },
        });
        console.log("Payment voided, link marked as ACTIVE:", link.id);
        break;

      default:
        console.log("Unhandled event type:", payload.type);
    }

    // Mark webhook as processed
    await prisma.webhookLog.update({
      where: { eventId: payload.id },
      data: { processed: true },
    });

    return NextResponse.json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
}
