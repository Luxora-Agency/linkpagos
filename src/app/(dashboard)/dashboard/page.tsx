import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Users, DollarSign, TrendingUp } from "lucide-react";
import { DashboardCharts } from "./dashboard-charts";

async function getStats(userId: string, role: string) {
  const isAdmin = role === "SUPERADMIN" || role === "ADMIN";
  const whereUser = isAdmin ? {} : { userId };

  const [totalLinks, activeLinks, paidLinks, expiredLinks, processingLinks, totalUsers] =
    await Promise.all([
      prisma.paymentLink.count({ where: whereUser }),
      prisma.paymentLink.count({ where: { ...whereUser, status: "ACTIVE" } }),
      prisma.paymentLink.count({ where: { ...whereUser, status: "PAID" } }),
      prisma.paymentLink.count({ where: { ...whereUser, status: "EXPIRED" } }),
      prisma.paymentLink.count({ where: { ...whereUser, status: "PROCESSING" } }),
      isAdmin ? prisma.user.count() : Promise.resolve(0),
    ]);

  const paidLinksData = await prisma.paymentLink.findMany({
    where: { ...whereUser, status: "PAID" },
    select: { amount: true, paidAt: true },
  });

  const totalRevenue = paidLinksData.reduce((acc, link) => acc + link.amount, 0);

  // Get revenue by day (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const revenueByDay = await prisma.paymentLink.groupBy({
    by: ["paidAt"],
    where: {
      ...whereUser,
      status: "PAID",
      paidAt: { gte: sevenDaysAgo },
    },
    _sum: { amount: true },
  });

  // Get links created by day (last 7 days)
  const linksCreatedByDay = await prisma.paymentLink.findMany({
    where: {
      ...whereUser,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true },
  });

  // Process data for charts
  const revenueData: Array<{ date: string; amount: number }> = [];
  const linksData: Array<{ date: string; count: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
    });

    // Revenue for this day
    const dayRevenue = paidLinksData
      .filter((link) => {
        if (!link.paidAt) return false;
        const linkDate = new Date(link.paidAt);
        return linkDate.toDateString() === date.toDateString();
      })
      .reduce((sum, link) => sum + link.amount, 0);

    revenueData.push({ date: dateStr, amount: dayRevenue });

    // Links created this day
    const dayLinks = linksCreatedByDay.filter((link) => {
      const linkDate = new Date(link.createdAt);
      return linkDate.toDateString() === date.toDateString();
    }).length;

    linksData.push({ date: dateStr, count: dayLinks });
  }

  return {
    totalLinks,
    activeLinks,
    paidLinks,
    expiredLinks,
    processingLinks,
    totalUsers,
    totalRevenue,
    revenueData,
    linksData,
  };
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "GESTOR") {
    redirect("/links");
  }

  const stats = await getStats(session.user.id, session.user.role);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Bienvenido, {session.user.name}. Aqui tienes un resumen de tu actividad.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Total Links
            </CardTitle>
            <Link2 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalLinks}</div>
            <p className="text-xs text-slate-500">Links creados</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Links Activos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.activeLinks}</div>
            <p className="text-xs text-slate-500">Pendientes de pago</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Links Pagados
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.paidLinks}</div>
            <p className="text-xs text-slate-500">Transacciones exitosas</p>
          </CardContent>
        </Card>

        {(session.user.role === "SUPERADMIN" || session.user.role === "ADMIN") && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                Usuarios
              </CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
              <p className="text-xs text-slate-500">Usuarios registrados</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Ingresos Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <p className="text-slate-400 mt-2">
            Total recaudado de {stats.paidLinks} pagos exitosos
          </p>
        </CardContent>
      </Card>

      <DashboardCharts
        statusData={{
          active: stats.activeLinks,
          paid: stats.paidLinks,
          expired: stats.expiredLinks,
          processing: stats.processingLinks,
        }}
        revenueData={stats.revenueData}
        linksData={stats.linksData}
      />
    </div>
  );
}
