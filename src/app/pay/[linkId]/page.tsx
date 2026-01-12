import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPaymentLinkStatus } from "@/lib/bold";
import { getWompiPaymentLinkStatus } from "@/lib/wompi";
import { PaymentPageClient } from "./payment-client";

interface PageProps {
  params: Promise<{ linkId: string }>;
}

async function getPaymentLink(linkId: string) {
  const link = await prisma.paymentLink.findFirst({
    where: {
      OR: [{ id: linkId }, { providerLinkId: linkId }],
    },
  });

  if (!link) return null;

  // Sync status with provider if active
  if (link.providerLinkId && link.status === "ACTIVE") {
    try {
      if (link.provider === "BOLD") {
        const boldStatus = await getPaymentLinkStatus(link.providerLinkId);

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
      } else if (link.provider === "WOMPI") {
        const wompiStatus = await getWompiPaymentLinkStatus(link.providerLinkId);
        const isActive = wompiStatus.data.active;

        // Only update if link is expired on Wompi
        if (!isActive && link.status === "ACTIVE") {
          await prisma.paymentLink.update({
            where: { id: link.id },
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
        provider: link.provider,
        providerUrl: link.providerUrl,
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
