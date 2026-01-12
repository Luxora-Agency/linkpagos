import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { 
  createWompiTransaction, 
  getMerchantInfo 
} from "@/lib/wompi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { linkId } = await params;
    const body = await request.json();
    const { 
      paymentMethod, 
      customerEmail, 
      acceptanceToken, 
      personalDataToken 
    } = body;

    // 1. Get the payment link from DB
    const link = await prisma.paymentLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return NextResponse.json({ error: "Link de pago no encontrado" }, { status: 404 });
    }

    if (link.status === "PAID" || link.status === "EXPIRED") {
      return NextResponse.json({ error: "Este link ya no está disponible para pagos" }, { status: 400 });
    }

    // 2. Generate a unique reference for this transaction
    const reference = `${link.id}_${Date.now()}`;

    // 3. Create transaction in Wompi
    try {
      const wompiResponse = await createWompiTransaction({
        amount: link.amount,
        customerEmail,
        reference,
        paymentMethod,
        acceptanceToken,
        acceptPersonalAuth: personalDataToken,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/callback`,
      });

      // 4. Update link status to PROCESSING
      await prisma.paymentLink.update({
        where: { id: link.id },
        data: {
          status: "PROCESSING",
          transactionId: wompiResponse.data.id,
          payerEmail: customerEmail,
        },
      });

      return NextResponse.json({ 
        success: true, 
        data: wompiResponse.data 
      });

    } catch (wompiError: any) {
      console.error("Wompi Transaction Error:", wompiError);
      return NextResponse.json({ 
        error: wompiError.message || "Error al procesar el pago con Wompi" 
      }, { status: 400 });
    }

  } catch (error) {
    console.error("Internal Pay API Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// GET helper to provide acceptance tokens to the frontend
export async function GET() {
  try {
    const merchantInfo = await getMerchantInfo();
    return NextResponse.json({
      acceptanceToken: merchantInfo.data.presigned_acceptance.acceptance_token,
      personalDataToken: merchantInfo.data.presigned_personal_data_auth.acceptance_token,
      publicKey: process.env.WOMPI_PUBLIC_KEY
    });
  } catch (error) {
    return NextResponse.json({ error: "Error fetching merchant info" }, { status: 500 });
  }
}
