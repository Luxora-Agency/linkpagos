import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          paymentLinks: true,
        },
      },
    },
  });

  return user;
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await getUserProfile(session.user.id);

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        linksCount: user._count.paymentLinks,
      }}
    />
  );
}
