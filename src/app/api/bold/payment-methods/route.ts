import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPaymentMethods } from "@/lib/bold";

// GET /api/bold/payment-methods - Get available payment methods from Bold
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const response = await getPaymentMethods();

    if (response.errors && response.errors.length > 0) {
      return NextResponse.json(
        { error: response.errors.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(response.payload);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json(
      { error: "Error al obtener métodos de pago" },
      { status: 500 }
    );
  }
}
