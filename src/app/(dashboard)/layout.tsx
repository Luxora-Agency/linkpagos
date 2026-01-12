import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar userRole={session.user.role} userName={session.user.name} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
