"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Trash2,
  RefreshCw,
  Calendar,
  CreditCard,
  User,
  Mail,
  Clock,
} from "lucide-react";

interface PaymentLink {
  id: string;
  boldLinkId: string | null;
  boldUrl: string | null;
  title: string;
  description: string | null;
  amount: number;
  amountType: string;
  currency: string;
  logoUrl: string | null;
  status: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
  expirationDate: string | null;
  paymentMethods: string[];
  transactionId: string | null;
  paymentMethod: string | null;
  payerEmail: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface LinkDetailClientProps {
  link: PaymentLink;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: "Tarjeta de Crédito",
  PSE: "PSE",
  NEQUI: "Nequi",
  BOTON_BANCOLOMBIA: "Botón Bancolombia",
  CARD: "Tarjeta",
  CARD_WEB: "Tarjeta Web",
};

export function LinkDetailClient({ link }: LinkDetailClientProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar este link de pago?`)) return;

    try {
      const res = await fetch(`/api/links/${link.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Link eliminado");
        router.push("/links");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar link");
      }
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("Error al eliminar link");
    }
  };

  const handleRefresh = () => {
    router.refresh();
    toast.success("Estado actualizado");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
      PROCESSING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      PAID: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      EXPIRED: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    const labels: Record<string, string> = {
      ACTIVE: "Activo",
      PROCESSING: "Procesando",
      PAID: "Pagado",
      EXPIRED: "Expirado",
    };

    return (
      <Badge variant="outline" className={`${styles[status]} text-lg px-4 py-1`}>
        {labels[status]}
      </Badge>
    );
  };

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${link.id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">{link.title}</h1>
            <p className="text-slate-400">{link.boldLinkId || link.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-slate-700 text-slate-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {link.status !== "PAID" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Información del Link</CardTitle>
                {getStatusBadge(link.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo and Amount */}
              <div className="flex items-center gap-6">
                {link.logoUrl && (
                  <img
                    src={link.logoUrl}
                    alt={link.title}
                    className="w-24 h-24 rounded-xl object-cover border border-slate-700"
                  />
                )}
                <div>
                  <p className="text-sm text-slate-400">Monto</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {formatCurrency(link.amount)}
                  </p>
                  <p className="text-sm text-slate-500">{link.currency}</p>
                </div>
              </div>

              <Separator className="bg-slate-800" />

              {/* Description */}
              {link.description && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Descripción</p>
                  <p className="text-white">{link.description}</p>
                </div>
              )}

              {/* Payment Methods */}
              <div>
                <p className="text-sm text-slate-400 mb-2">Métodos de pago</p>
                <div className="flex flex-wrap gap-2">
                  {link.paymentMethods.map((method) => (
                    <Badge
                      key={method}
                      variant="outline"
                      className="bg-slate-800 border-slate-700 text-slate-300"
                    >
                      {PAYMENT_METHOD_LABELS[method] || method}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Creado
                  </p>
                  <p className="text-white">{formatDate(link.createdAt)}</p>
                </div>
                {link.expirationDate && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Expira
                    </p>
                    <p className="text-white">{formatDate(link.expirationDate)}</p>
                  </div>
                )}
              </div>

              {/* Creator */}
              <div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Creado por
                </p>
                <p className="text-white">
                  {link.user.name} ({link.user.email})
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Info (if paid) */}
          {link.status === "PAID" && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-400" />
                  Información del Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {link.transactionId && (
                    <div>
                      <p className="text-sm text-slate-400">ID Transacción</p>
                      <p className="text-white font-mono">{link.transactionId}</p>
                    </div>
                  )}
                  {link.paymentMethod && (
                    <div>
                      <p className="text-sm text-slate-400">Método de Pago</p>
                      <p className="text-white">
                        {PAYMENT_METHOD_LABELS[link.paymentMethod] || link.paymentMethod}
                      </p>
                    </div>
                  )}
                  {link.payerEmail && (
                    <div>
                      <p className="text-sm text-slate-400 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email del Pagador
                      </p>
                      <p className="text-white">{link.payerEmail}</p>
                    </div>
                  )}
                  {link.paidAt && (
                    <div>
                      <p className="text-sm text-slate-400">Fecha de Pago</p>
                      <p className="text-white">{formatDate(link.paidAt)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {link.boldUrl && (
                <>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    onClick={() => window.open(link.boldUrl!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir en Bold
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-slate-700 text-slate-300"
                    onClick={() => copyToClipboard(link.boldUrl!)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar URL Bold
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300"
                onClick={() => copyToClipboard(publicUrl)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar URL Pública
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300"
                onClick={() => window.open(publicUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Página de Pago
              </Button>
            </CardContent>
          </Card>

          {/* URLs Info */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {link.boldUrl && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">URL de Bold</p>
                  <p className="text-xs text-slate-300 break-all font-mono bg-slate-800 p-2 rounded">
                    {link.boldUrl}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-1">URL Pública</p>
                <p className="text-xs text-slate-300 break-all font-mono bg-slate-800 p-2 rounded">
                  {publicUrl}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
