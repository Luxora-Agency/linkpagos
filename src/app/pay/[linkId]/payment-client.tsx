"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Building2,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentLink {
  id: string;
  provider: "BOLD" | "WOMPI";
  providerUrl: string | null;
  title: string;
  description: string | null;
  amount: number;
  amountUsd: number | null;
  logoUrl: string | null;
  status: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
  paymentMethods: string[];
}

interface Bank {
  financial_institution_code: string;
  financial_institution_name: string;
}

interface PaymentPageClientProps {
  link: PaymentLink;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  CARD: <CreditCard className="w-5 h-5" />,
  PSE: <Building2 className="w-5 h-5" />,
  NEQUI: <Smartphone className="w-5 h-5" />,
  BANCOLOMBIA_TRANSFER: <Building2 className="w-5 h-5" />,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  BANCOLOMBIA_TRANSFER: "Bancolombia",
};

export function PaymentPageClient({ link }: PaymentPageClientProps) {
  const [step, setStep] = useState<"overview" | "checkout">("overview");
  const [method, setMethod] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [tokens, setTokens] = useState<{ acceptance: string; personal: string; publicKey: string } | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [cardData, setCardData] = useState({ number: "", cvc: "", expMonth: "", expYear: "", name: "" });
  const [pseData, setPseData] = useState({ bank: "", userType: "0", idType: "CC", id: "" });
  const [nequiData, setNequiData] = useState({ phone: "" });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatUsd = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  useEffect(() => {
    if (step === "checkout") {
      fetchTokens();
      if (link.paymentMethods.includes("PSE")) {
        fetchBanks();
      }
    }
  }, [step]);

  const fetchTokens = async () => {
    try {
      const res = await fetch(`/api/pay/${link.id}`);
      const data = await res.json();
      if (res.ok) setTokens(data);
    } catch (e) {
      console.error("Error fetching tokens", e);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await fetch("https://production.wompi.co/v1/pse/financial_institutions", {
        headers: { Authorization: `Bearer ${tokens?.publicKey}` }
      });
      const data = await res.json();
      if (data.data) setBanks(data.data);
    } catch (e) {
      // Fallback
    }
  };

  const handleStartPayment = () => {
    setStep("checkout");
    if (link.paymentMethods.length > 0) {
      setMethod(link.paymentMethods[0]);
    }
  };

  const processCardPayment = async () => {
    if (!tokens) return;
    setLoading(true);
    try {
      // 1. Tokenize Card
      const tokenRes = await fetch("https://production.wompi.co/v1/tokens/cards", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.publicKey}` 
        },
        body: JSON.stringify({
          number: cardData.number.replace(/\s/g, ""),
          cvc: cardData.cvc,
          exp_month: cardData.expMonth,
          exp_year: cardData.expYear,
          card_holder: cardData.name,
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error?.message || "Error al validar tarjeta");

      // 2. Send to our API
      const res = await fetch(`/api/pay/${link.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: {
            type: "CARD",
            token: tokenData.data.id,
            installments: 1
          },
          customerEmail: email,
          acceptanceToken: tokens.acceptance,
          personalDataToken: tokens.personal
        })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Pago iniciado");
        window.location.reload(); // To show processing status
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const processPsePayment = async () => {
    if (!tokens) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${link.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: {
            type: "PSE",
            user_type: parseInt(pseData.userType),
            user_legal_id_type: pseData.idType,
            user_legal_id: pseData.id,
            financial_institution_code: pseData.bank,
            payment_description: link.title
          },
          customerEmail: email,
          acceptanceToken: tokens.acceptance,
          personalDataToken: tokens.personal
        })
      });

      const result = await res.json();
      if (res.ok && result.data.payment_method.extra.async_payment_url) {
        window.location.href = result.data.payment_method.extra.async_payment_url;
      } else {
        toast.error(result.error || "Error al iniciar PSE");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const processNequiPayment = async () => {
    if (!tokens) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${link.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: {
            type: "NEQUI",
            phone_number: nequiData.phone
          },
          customerEmail: email,
          acceptanceToken: tokens.acceptance,
          personalDataToken: tokens.personal
        })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Revisa tu aplicación Nequi para aprobar el pago");
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "CARD") processCardPayment();
    else if (method === "PSE") processPsePayment();
    else if (method === "NEQUI") processNequiPayment();
  };

  // Status pages (PAID, EXPIRED, PROCESSING)
  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-green-500/30">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Pago Exitoso</h1>
            <p className="text-slate-400">Gracias por tu pago.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "PROCESSING") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-yellow-500/30">
          <CardContent className="p-8 text-center">
            <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
            <h1 className="text-2xl font-bold text-white mb-2">Pago en Proceso</h1>
            <p className="text-slate-400">Estamos verificando tu pago. Esto puede tardar unos minutos.</p>
            <Button className="mt-6 w-full bg-slate-800" onClick={() => window.location.reload()}>Actualizar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 font-sans">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>
        
        <CardContent className="p-8">
          {step === "overview" ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                {link.logoUrl ? (
                  <img src={link.logoUrl} alt="Logo" className="w-20 h-20 mx-auto rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="w-20 h-20 mx-auto bg-purple-500/10 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-10 h-10 text-purple-400" />
                  </div>
                )}
                <h1 className="text-2xl font-bold text-white">{link.title}</h1>
                <p className="text-slate-400 text-sm">{link.description}</p>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700/50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total a pagar</span>
                <div className="text-4xl font-black text-white mt-1">{formatCurrency(link.amount)}</div>
                {link.amountUsd && (
                  <div className="text-sm text-slate-400 mt-2 font-medium">~ {formatUsd(link.amountUsd)} USD</div>
                )}
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block text-center">Paga de forma segura con</span>
                <div className="flex justify-center gap-4">
                  {link.paymentMethods.map(m => (
                    <div key={m} className="p-2 bg-slate-800 rounded-lg text-slate-400" title={PAYMENT_METHOD_LABELS[m]}>
                      {PAYMENT_METHOD_ICONS[m]}
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleStartPayment}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/20 rounded-xl"
              >
                Pagar Ahora
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setStep("overview")} className="text-slate-400 hover:text-white flex items-center text-sm font-medium">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                </button>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block uppercase">Monto</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(link.amount)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs uppercase font-bold">Método de pago</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {link.paymentMethods.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                          method === m ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        {PAYMENT_METHOD_ICONS[m]}
                        <span className="text-[10px] mt-1 font-bold uppercase">{PAYMENT_METHOD_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs uppercase font-bold">Tu Email</Label>
                  <Input 
                    required 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-slate-800 border-slate-700 h-12 focus:ring-purple-500"
                  />
                </div>

                {method === "CARD" && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-[10px] uppercase">Número de Tarjeta</Label>
                      <div className="relative">
                        <Input 
                          required 
                          placeholder="0000 0000 0000 0000"
                          value={cardData.number}
                          onChange={e => setCardData({...cardData, number: e.target.value})}
                          className="bg-slate-800 border-slate-700 h-12 pl-10"
                        />
                        <CreditCard className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-400 text-[10px] uppercase">Expira (MM/YY)</Label>
                        <div className="flex gap-2">
                          <Input required placeholder="MM" maxLength={2} value={cardData.expMonth} onChange={e => setCardData({...cardData, expMonth: e.target.value})} className="bg-slate-800 border-slate-700 h-12 text-center" />
                          <Input required placeholder="YY" maxLength={2} value={cardData.expYear} onChange={e => setCardData({...cardData, expYear: e.target.value})} className="bg-slate-800 border-slate-700 h-12 text-center" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-400 text-[10px] uppercase">CVC</Label>
                        <Input required type="password" placeholder="***" maxLength={4} value={cardData.cvc} onChange={e => setCardData({...cardData, cvc: e.target.value})} className="bg-slate-800 border-slate-700 h-12 text-center" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-[10px] uppercase">Nombre en Tarjeta</Label>
                      <Input required placeholder="NOMBRE COMPLETO" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value})} className="bg-slate-800 border-slate-700 h-12" />
                    </div>
                  </div>
                )}

                {method === "PSE" && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-[10px] uppercase">Banco</Label>
                      <Select value={pseData.bank} onValueChange={v => setPseData({...pseData, bank: v})}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 h-12 text-white">
                          <SelectValue placeholder="Selecciona tu banco" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                          {banks.map(b => (
                            <SelectItem key={b.financial_institution_code} value={b.financial_institution_code}>
                              {b.financial_institution_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2 col-span-1">
                        <Label className="text-slate-400 text-[10px] uppercase">Tipo ID</Label>
                        <Select value={pseData.idType} onValueChange={v => setPseData({...pseData, idType: v})}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 h-12 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="CC">CC</SelectItem>
                            <SelectItem value="CE">CE</SelectItem>
                            <SelectItem value="NIT">NIT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-slate-400 text-[10px] uppercase">Número de ID</Label>
                        <Input required value={pseData.id} onChange={e => setPseData({...pseData, id: e.target.value})} className="bg-slate-800 border-slate-700 h-12" />
                      </div>
                    </div>
                  </div>
                )}

                {method === "NEQUI" && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2 text-center pb-2">
                      <div className="w-12 h-12 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Smartphone className="w-6 h-6 text-pink-500" />
                      </div>
                      <p className="text-xs text-slate-400">Recibirás una notificación en tu Nequi para autorizar el pago.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-[10px] uppercase">Celular Nequi</Label>
                      <Input required placeholder="3001234567" value={nequiData.phone} onChange={e => setNequiData({...nequiData, phone: e.target.value})} className="bg-slate-800 border-slate-700 h-12 text-center text-lg tracking-widest" />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button 
                  disabled={loading || !method || !email}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/20 rounded-xl disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : `Pagar ${formatCurrency(link.amount)}`}
                </Button>
                <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  <Lock className="w-3 h-3" /> Transacción Segura • SSL Encriptado
                </div>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-center gap-4 grayscale opacity-40">
            <img src="https://wompi.com/assets/img/logo-wompi.png" alt="Wompi" className="h-4" />
            <span className="text-xs text-slate-600 font-bold">SECURED BY WOMPI</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}