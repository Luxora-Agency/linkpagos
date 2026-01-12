import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPaymentLinkStatus } from "@/lib/bold";
import { PaymentPageClient } from "./payment-client";

interface PageProps {
  params: Promise<{ linkId: string }>;
}

async function getPaymentLink(linkId: string) {
  const link = await prisma.paymentLink.findFirst({
    where: {
      OR: [{ id: linkId }, { boldLinkId: linkId }],
    },
  });

  if (!link) return null;

  // Sync status with Bold if active
  if (link.boldLinkId && link.status === "ACTIVE") {
    try {
      const boldStatus = await getPaymentLinkStatus(link.boldLinkId);

      if (boldStatus.status !== link.status) {
        await prisma.paymentLink.update({
          where: { id: link.id },
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

export default async function PaymentPage({ params }: PageProps) {
  const { linkId } = await params;
  const link = await getPaymentLink(linkId);

  if (!link) {
    notFound();
  }

  return (
    <PaymentPageClient
      link={{
        id: link.id,
        boldUrl: link.boldUrl,
        title: link.title,
        description: link.description,
        amount: link.amount,
        logoUrl: link.logoUrl,
        status: link.status,
        paymentMethods: link.paymentMethods,
      }}
    />
  );
}
