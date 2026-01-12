"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Link2,
  Loader2,
  Lock,
  Save,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "GESTOR";
  createdAt: string;
  linksCount: number;
}

interface SettingsClientProps {
  user: UserProfile;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Super Administrador",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
};

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  ADMIN: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  GESTOR: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-CO", {
      dateStyle: "long",
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        toast.success("Perfil actualizado correctamente");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar perfil");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar perfil");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Todos los campos son requeridos");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Contraseña actualizada correctamente");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar contraseña");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("Error al actualizar contraseña");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configuracion</h1>
        <p className="text-slate-400 mt-1">
          Administra tu perfil y preferencias de cuenta
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Overview */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-purple-400" />
              Tu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold text-white">{user.name}</h3>
              <p className="text-slate-400">{user.email}</p>
            </div>

            <div className="flex justify-center">
              <Badge variant="outline" className={ROLE_COLORS[user.role]}>
                <Shield className="h-3 w-3 mr-1" />
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Miembro desde
                </span>
                <span className="text-white">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Links creados
                </span>
                <span className="text-white">{user.linksCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Update Profile */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Informacion Personal</CardTitle>
              <CardDescription>
                Actualiza tu nombre y datos de perfil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email
                  </Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      value={user.email}
                      disabled
                      className="bg-slate-800 border-slate-700 text-slate-400"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    El email no se puede cambiar
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">
                    Nombre
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isUpdatingProfile || name === user.name}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Update Password */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-yellow-400" />
                Cambiar Contraseña
              </CardTitle>
              <CardDescription>
                Actualiza tu contraseña de acceso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-slate-300">
                    Contraseña Actual
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Tu contraseña actual"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-300">
                    Nueva Contraseña
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 6 caracteres"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">
                    Confirmar Nueva Contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  variant="outline"
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Cambiar Contraseña
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
