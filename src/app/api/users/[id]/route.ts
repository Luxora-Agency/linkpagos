import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email("Email inválido").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "GESTOR"]).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users/[id] - Get a specific user
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

    // Users can view their own profile, admins can view others
    if (
      session.user.id !== id &&
      session.user.role !== "SUPERADMIN" &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { paymentLinks: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // ADMIN can only view GESTORs
    if (
      session.user.role === "ADMIN" &&
      session.user.id !== id &&
      user.role !== "GESTOR"
    ) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Error al obtener usuario" },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Get the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Check permissions
    const isOwnProfile = session.user.id === id;
    const isSuperAdmin = session.user.role === "SUPERADMIN";
    const isAdmin = session.user.role === "ADMIN";

    // GESTORs can only update their own profile (name, email, password)
    if (!isSuperAdmin && !isAdmin && !isOwnProfile) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // ADMINs can only update GESTORs
    if (isAdmin && !isOwnProfile && userToUpdate.role !== "GESTOR") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Non-admins can't change roles
    if (!isSuperAdmin && !isAdmin && validation.data.role) {
      return NextResponse.json(
        { error: "No puedes cambiar tu rol" },
        { status: 403 }
      );
    }

    // ADMINs can only assign GESTOR role
    if (isAdmin && validation.data.role && validation.data.role !== "GESTOR") {
      return NextResponse.json(
        { error: "Solo puedes asignar rol GESTOR" },
        { status: 403 }
      );
    }

    // Check if email is already taken
    if (validation.data.email && validation.data.email !== userToUpdate.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validation.data.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "El email ya está registrado" },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (validation.data.email) updateData.email = validation.data.email;
    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.password) {
      updateData.password = await hash(validation.data.password, 12);
    }
    if (validation.data.role && (isSuperAdmin || isAdmin)) {
      updateData.role = validation.data.role;
    }
    if (typeof validation.data.isActive === "boolean" && (isSuperAdmin || isAdmin)) {
      updateData.isActive = validation.data.isActive;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
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

    // Only admins can delete users
    if (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Can't delete yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // ADMINs can only delete GESTORs
    if (session.user.role === "ADMIN" && userToDelete.role !== "GESTOR") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Usuario eliminado" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}
