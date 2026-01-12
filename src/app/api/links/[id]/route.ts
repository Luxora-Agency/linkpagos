import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getPaymentLinkStatus } from "@/lib/bold";
import { getWompiPaymentLinkStatus } from "@/lib/wompi";

// GET /api/links/[id] - Get a specific payment link
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!link) {
      return NextResponse.json(
        { error: "Link no encontrado" },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = session.user.role === "SUPERADMIN" || session.user.role === "ADMIN";
    if (!isAdmin && link.userId !== session.user.id) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Sync status with provider if link is active
    if (link.providerLinkId && link.status === "ACTIVE") {
      try {
        if (link.provider === "BOLD") {
          const boldStatus = await getPaymentLinkStatus(link.providerLinkId);

          if (boldStatus.status !== link.status) {
            await prisma.paymentLink.update({
              where: { id },
              data: {
                status: boldStatus.status as "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED",
                transactionId: boldStatus.transaction_id,
                paymentMethod: boldStatus.payment_method,
                paidAt: boldStatus.status === "PAID" ? new Date() : null,
              },
            });

            link.status = boldStatus.status as "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
          }
        } else if (link.provider === "WOMPI") {
          const wompiStatus = await getWompiPaymentLinkStatus(link.providerLinkId);
          const isActive = wompiStatus.data.active;

          if (!isActive && link.status === "ACTIVE") {
            await prisma.paymentLink.update({
              where: { id },
              data: {
                status: "EXPIRED",
              },
            });

            link.status = "EXPIRED";
          }
        }
      } catch (error) {
        console.error(`Error syncing with ${link.provider}:`, error);
      }
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error("Error fetching link:", error);
    return NextResponse.json(
      { error: "Error al obtener link" },
      { status: 500 }
    );
  }
}

// DELETE /api/links/[id] - Delete a payment link
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id },
    });

    if (!link) {
      return NextResponse.json(
        { error: "Link no encontrado" },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = session.user.role === "SUPERADMIN" || session.user.role === "ADMIN";
    if (!isAdmin && link.userId !== session.user.id) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Can't delete paid links
    if (link.status === "PAID") {
      return NextResponse.json(
        { error: "No se puede eliminar un link que ya fue pagado" },
        { status: 400 }
      );
    }

    await prisma.paymentLink.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Link eliminado" });
  } catch (error) {
    console.error("Error deleting link:", error);
    return NextResponse.json(
      { error: "Error al eliminar link" },
      { status: 500 }
    );
  }
}
