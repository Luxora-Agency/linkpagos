import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createBoldLink } from "@/lib/bold";
import { createWompiLink } from "@/lib/wompi";
import { z } from "zod";
import { PaymentProvider } from "@prisma/client";

const createLinkSchema = z.object({
  title: z.string().min(2, "El título debe tener al menos 2 caracteres"),
  description: z.string().max(100).optional(),
  amount: z.number().min(1000, "El monto mínimo es $1,000 COP"),
  amountUsd: z.number().optional().nullable(),
  amountType: z.enum(["OPEN", "CLOSE"]).default("CLOSE"),
  logoUrl: z.string().url().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  callbackUrl: z.string().url().optional().nullable(),
  paymentMethods: z.array(z.string()).optional(),
  provider: z.enum(["BOLD", "WOMPI"]).default("WOMPI"),
});

// GET /api/links - List all payment links
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const isAdmin = session.user.role === "SUPERADMIN" || session.user.role === "ADMIN";

    const where: Record<string, unknown> = {};

    // Non-admins can only see their own links
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Filter by provider if provided
    if (provider) {
      where.provider = provider;
    }

    const [links, total] = await Promise.all([
      prisma.paymentLink.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentLink.count({ where }),
    ]);

    return NextResponse.json({
      data: links,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching links:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error al obtener links", details: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/links - Create a new payment link
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createLinkSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      amount,
      amountUsd,
      amountType,
      logoUrl,
      expirationDate,
      callbackUrl,
      paymentMethods,
      provider,
    } = validation.data;

    let providerLinkId: string | null = null;
    let providerUrl: string | null = null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pagos.guerrerogroup.org";

    if (provider === "BOLD") {
      // Create link in Bold
      const boldResponse = await createBoldLink({
        title,
        description: description || title,
        amount,
        amountType,
        logoUrl: logoUrl || undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        callbackUrl: callbackUrl || undefined,
        paymentMethods,
      });

      if (boldResponse.errors && boldResponse.errors.length > 0) {
        return NextResponse.json(
          { error: boldResponse.errors.join(", ") },
          { status: 400 }
        );
      }

      providerLinkId = boldResponse.payload.payment_link;
      providerUrl = boldResponse.payload.url;
    } else if (provider === "WOMPI") {
      // Create link in Wompi
      try {
        const wompiResponse = await createWompiLink({
          title,
          description: description || title,
          amount,
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          redirectUrl: `${appUrl}/pay/callback`,
          logoUrl: logoUrl || undefined,
        });

        console.log("Wompi Response:", JSON.stringify(wompiResponse, null, 2));

        providerLinkId = wompiResponse.linkId;
        providerUrl = wompiResponse.url;
      } catch (error) {
        console.error("Wompi API Error:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Error al crear link en Wompi" },
          { status: 400 }
        );
      }
    }

    // Save to database
    const link = await prisma.paymentLink.create({
      data: {
        provider: provider as PaymentProvider,
        providerLinkId,
        providerUrl,
        title,
        description,
        amount,
        amountUsd,
        amountType,
        logoUrl,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        callbackUrl,
        paymentMethods: paymentMethods || ["CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"],
        userId: session.user.id,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error creating link:", error);
    return NextResponse.json(
      { error: "Error al crear link de pago" },
      { status: 500 }
    );
  }
}
