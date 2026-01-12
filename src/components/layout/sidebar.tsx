"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Link2,
  Users,
  LogOut,
  Settings,
} from "lucide-react";
import { Role } from "@prisma/client";

interface SidebarProps {
  userRole: Role;
  userName: string;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    name: "Links de Pago",
    href: "/links",
    icon: Link2,
    roles: ["SUPERADMIN", "ADMIN", "GESTOR"],
  },
  {
    name: "Usuarios",
    href: "/users",
    icon: Users,
    roles: ["SUPERADMIN", "ADMIN"],
  },
];

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <Link2 className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">LinkPagos</span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-400">{userRole}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-slate-400 hover:text-white hover:bg-slate-800"
            asChild
          >
            <Link href="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Config
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}
