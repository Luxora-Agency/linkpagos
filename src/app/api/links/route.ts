import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createBoldLink } from "@/lib/bold";
import { z } from "zod";

const createLinkSchema = z.object({
  title: z.string().min(2, "El título debe tener al menos 2 caracteres"),
  description: z.string().max(100).optional(),
  amount: z.number().min(1000, "El monto mínimo es $1,000 COP"),
  amountType: z.enum(["OPEN", "CLOSE"]).default("CLOSE"),
  logoUrl: z.string().url().optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  callbackUrl: z.string().url().optional().nullable(),
  paymentMethods: z.array(z.string()).optional(),
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
    return NextResponse.json(
      { error: "Error al obtener links" },
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
      amountType,
      logoUrl,
      expirationDate,
      callbackUrl,
      paymentMethods,
    } = validation.data;

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

    // Save to database
    const link = await prisma.paymentLink.create({
      data: {
        boldLinkId: boldResponse.payload.payment_link,
        boldUrl: boldResponse.payload.url,
        title,
        description,
        amount,
        amountType,
        logoUrl,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        callbackUrl,
        paymentMethods: paymentMethods || ["CREDIT_CARD", "PSE", "NEQUI", "BOTON_BANCOLOMBIA"],
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
