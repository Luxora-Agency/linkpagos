import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPaymentLinkStatus } from "@/lib/bold";
import { LinkDetailClient } from "./link-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getLink(id: string, userId: string, role: string) {
  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });

  if (!link) return null;

  // Check permissions
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";
  if (!isAdmin && link.userId !== userId) {
    return null;
  }

  // Sync status with Bold if active
  if (link.boldLinkId && link.status === "ACTIVE") {
    try {
      const boldStatus = await getPaymentLinkStatus(link.boldLinkId);

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
    } catch (error) {
      console.error("Error syncing with Bold:", error);
    }
  }

  return link;
}

export default async function LinkDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const link = await getLink(id, session.user.id, session.user.role);

  if (!link) {
    notFound();
  }

  return (
    <LinkDetailClient
      link={{
        id: link.id,
        boldLinkId: link.boldLinkId,
        boldUrl: link.boldUrl,
        title: link.title,
        description: link.description,
        amount: link.amount,
        amountType: link.amountType,
        currency: link.currency,
        logoUrl: link.logoUrl,
        status: link.status,
        expirationDate: link.expirationDate?.toISOString() || null,
        paymentMethods: link.paymentMethods,
        transactionId: link.transactionId,
        paymentMethod: link.paymentMethod,
        payerEmail: link.payerEmail,
        paidAt: link.paidAt?.toISOString() || null,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
        user: link.user,
      }}
    />
  );
}
