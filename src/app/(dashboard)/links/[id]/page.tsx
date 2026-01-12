import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPaymentLinkStatus } from "@/lib/bold";
import { getWompiPaymentLinkStatus } from "@/lib/wompi";
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

  // Sync status with provider if active
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

        // Only update if the link is not already paid and the status has changed
        if (isActive && link.status !== "ACTIVE") {
          // Link is active on Wompi but not marked active locally
        } else if (!isActive && link.status === "ACTIVE") {
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
        provider: link.provider,
        providerLinkId: link.providerLinkId,
        providerUrl: link.providerUrl,
        title: link.title,
        description: link.description,
        amount: link.amount,
        amountUsd: link.amountUsd,
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
