"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Building2,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface PaymentLink {
  id: string;
  provider: "BOLD" | "WOMPI";
  providerUrl: string | null;
  title: string;
  description: string | null;
  amount: number;
  logoUrl: string | null;
  status: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
  paymentMethods: string[];
}

interface PaymentPageClientProps {
  link: PaymentLink;
}

// Payment method icons for both providers
const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  // Bold methods
  CREDIT_CARD: <CreditCard className="w-5 h-5" />,
  BOTON_BANCOLOMBIA: <Building2 className="w-5 h-5" />,
  // Wompi methods
  CARD: <CreditCard className="w-5 h-5" />,
  BANCOLOMBIA_TRANSFER: <Building2 className="w-5 h-5" />,
  // Shared methods
  PSE: <Building2 className="w-5 h-5" />,
  NEQUI: <Smartphone className="w-5 h-5" />,
};

// Payment method labels for both providers
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  // Bold methods
  CREDIT_CARD: "Tarjeta",
  BOTON_BANCOLOMBIA: "Bancolombia",
  // Wompi methods
  CARD: "Tarjeta",
  BANCOLOMBIA_TRANSFER: "Bancolombia",
  // Shared methods
  PSE: "PSE",
  NEQUI: "Nequi",
};

export function PaymentPageClient({ link }: PaymentPageClientProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayment = () => {
    if (link.providerUrl) {
      window.location.href = link.providerUrl;
    }
  };

  const getProviderName = () => {
    return link.provider === "BOLD" ? "Bold" : "Wompi";
  };

  const getProviderColor = () => {
    return link.provider === "BOLD"
      ? "from-orange-500 to-amber-500"
      : "from-emerald-500 to-teal-500";
  };

  // Status pages
  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900/20 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border-green-500/30">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Pago Completado</h1>
            <p className="text-slate-400 mb-4">
              Este link de pago ya fue utilizado exitosamente.
            </p>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              Pagado
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "EXPIRED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Link Expirado</h1>
            <p className="text-slate-400 mb-4">
              Este link de pago ha expirado y ya no puede ser utilizado.
            </p>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              Expirado
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "PROCESSING") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900/20 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border-yellow-500/30">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-yellow-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Procesando Pago</h1>
            <p className="text-slate-400 mb-4">
              Tu pago está siendo procesado. Por favor espera un momento.
            </p>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              Procesando
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active payment page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      <Card className="w-full max-w-md relative z-10 bg-slate-900/80 backdrop-blur-xl border-slate-800 overflow-hidden">
        {/* Gradient border effect */}
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getProviderColor()}`}></div>

        <CardContent className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            {link.logoUrl ? (
              <img
                src={link.logoUrl}
                alt={link.title}
                className="w-24 h-24 rounded-2xl object-cover shadow-lg shadow-purple-500/20"
              />
            ) : (
              <div className={`w-24 h-24 bg-gradient-to-br ${getProviderColor()} rounded-2xl flex items-center justify-center shadow-lg`}>
                <CreditCard className="w-10 h-10 text-white" />
              </div>
            )}
          </div>

          {/* Title & Description */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{link.title}</h1>
            {link.description && (
              <p className="text-slate-400">{link.description}</p>
            )}
          </div>

          {/* Amount */}
          <div className="bg-slate-800/50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-slate-400 text-center mb-2">
              Total a pagar
            </p>
            <p className={`text-4xl font-bold text-center bg-gradient-to-r ${getProviderColor()} bg-clip-text text-transparent`}>
              {formatCurrency(link.amount)}
            </p>
          </div>

          {/* Payment Methods */}
          <div className="mb-8">
            <p className="text-sm text-slate-400 text-center mb-4">
              Métodos de pago disponibles
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {link.paymentMethods.map((method) => (
                <div
                  key={method}
                  className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2"
                >
                  <span className={link.provider === "BOLD" ? "text-orange-400" : "text-emerald-400"}>
                    {PAYMENT_METHOD_ICONS[method] || <CreditCard className="w-5 h-5" />}
                  </span>
                  <span className="text-sm text-slate-300">
                    {PAYMENT_METHOD_LABELS[method] || method}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pay Button */}
          <Button
            onClick={handlePayment}
            disabled={!link.providerUrl}
            className={`w-full h-14 text-lg font-semibold bg-gradient-to-r ${getProviderColor()} hover:opacity-90 rounded-xl shadow-lg transition-all`}
          >
            Pagar Ahora
          </Button>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 mt-6 text-slate-500">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">Pago seguro con {getProviderName()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
