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
  ChevronRight,
  Info,
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

  // Shared Styles
  const primaryGradient = "from-blue-600 to-indigo-600";
  const glassEffect = "bg-slate-900/80 backdrop-blur-xl border-slate-800/50";

  // Status pages
  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
        <Card className={`w-full max-w-md ${glassEffect} border-blue-500/20 shadow-2xl`}>
          <CardContent className="p-10 text-center">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
              <CheckCircle className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">¡Pago Exitoso!</h1>
            <p className="text-slate-400 mb-8">La transacción se ha completado correctamente. Recibirás un comprobante en tu email.</p>
            <Button className={`w-full h-12 bg-gradient-to-r ${primaryGradient} font-bold rounded-xl`} onClick={() => window.close()}>
              Cerrar Ventana
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "PROCESSING") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${glassEffect} border-blue-500/20 shadow-2xl`}>
          <CardContent className="p-10 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-blue-500/30">
                <Clock className="w-10 h-10 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Procesando Pago</h1>
            <p className="text-slate-400">Estamos confirmando tu transacción con la entidad financiera. Esto no debería tomar más de un minuto.</p>
            <Button variant="outline" className="mt-8 w-full border-slate-700 text-slate-300" onClick={() => window.location.reload()}>
              Actualizar Estado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-4 selection:bg-blue-500/30">
      {/* Abstract Background Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <Card className={`w-full max-w-md ${glassEffect} shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] relative z-10 border-t-blue-500/50 border-t-2 overflow-hidden`}>
        <CardContent className="p-0">
          {step === "overview" ? (
            <div className="p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-4">
                {link.logoUrl ? (
                  <div className="inline-block p-1 bg-white/5 rounded-3xl border border-white/10 shadow-xl">
                    <img src={link.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight leading-tight">{link.title}</h1>
                  {link.description && <p className="text-slate-400 text-sm mt-2 leading-relaxed">{link.description}</p>}
                </div>
              </div>

              <div className="bg-blue-500/5 rounded-3xl p-8 text-center border border-blue-500/10 shadow-inner relative group">
                <div className="absolute top-3 right-4 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Info className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Resumen de Pago</span>
                <div className="text-5xl font-black text-white mt-2 tracking-tighter">{formatCurrency(link.amount)}</div>
                {link.amountUsd && (
                  <div className="text-sm font-medium text-blue-400/60 mt-2 flex items-center justify-center gap-1">
                    <span>≈ {formatUsd(link.amountUsd)} USD</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-slate-800" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Métodos Disponibles</span>
                  <div className="h-[1px] flex-1 bg-slate-800" />
                </div>
                <div className="flex justify-center gap-3">
                  {link.paymentMethods.map(m => (
                    <div key={m} className="w-12 h-12 flex items-center justify-center bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition-all cursor-default" title={PAYMENT_METHOD_LABELS[m]}>
                      {PAYMENT_METHOD_ICONS[m]}
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleStartPayment}
                className={`w-full h-16 text-lg font-black bg-gradient-to-r ${primaryGradient} hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] shadow-xl rounded-2xl transition-all active:scale-[0.98] group`}
              >
                Pagar Ahora
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Conexión Segura de 256 bits</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                <button type="button" onClick={() => setStep("overview")} className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total a pagar</p>
                  <p className="text-xl font-black text-blue-400">{formatCurrency(link.amount)}</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <Label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em]">Selecciona el Medio</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {link.paymentMethods.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 transition-all active:scale-95 ${
                          method === m ? 'border-blue-500 bg-blue-500/10 text-white ring-4 ring-blue-500/10' : 'border-slate-800 bg-slate-800/30 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        <div className={method === m ? 'text-blue-400' : ''}>{PAYMENT_METHOD_ICONS[m]}</div>
                        <span className="text-[9px] mt-2 font-black uppercase tracking-tighter">{PAYMENT_METHOD_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em]">Correo Electrónico</Label>
                  <div className="relative">
                    <Input 
                      required 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="bg-slate-800/50 border-slate-700 h-14 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all pl-12"
                    />
                    <div className="absolute left-4 top-4.5 text-slate-500">@</div>
                  </div>
                </div>

                <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50 space-y-5">
                  {method === "CARD" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-2">
                        <Label className="text-slate-500 text-[9px] uppercase font-bold">Número de Tarjeta</Label>
                        <div className="relative">
                          <Input 
                            required 
                            placeholder="0000 0000 0000 0000"
                            value={cardData.number}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                              if(v.length <= 19) setCardData({...cardData, number: v})
                            }}
                            className="bg-slate-900 border-slate-700 h-12 pl-11 font-mono tracking-wider"
                          />
                          <CreditCard className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">Vencimiento</Label>
                          <div className="flex gap-2">
                            <Input required placeholder="MM" maxLength={2} value={cardData.expMonth} onChange={e => setCardData({...cardData, expMonth: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono" />
                            <Input required placeholder="YY" maxLength={2} value={cardData.expYear} onChange={e => setCardData({...cardData, expYear: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">CVC</Label>
                          <Input required type="password" placeholder="***" maxLength={4} value={cardData.cvc} onChange={e => setCardData({...cardData, cvc: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-500 text-[9px] uppercase font-bold">Titular</Label>
                        <Input required placeholder="NOMBRE COMO APARECE" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="bg-slate-900 border-slate-700 h-12 uppercase" />
                      </div>
                    </div>
                  )}

                  {method === "PSE" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-2">
                        <Label className="text-slate-500 text-[9px] uppercase font-bold">Banco</Label>
                        <Select value={pseData.bank} onValueChange={v => setPseData({...pseData, bank: v})}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white rounded-xl">
                            <SelectValue placeholder="Busca tu banco..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-60">
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
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">Tipo</Label>
                          <Select value={pseData.idType} onValueChange={v => setPseData({...pseData, idType: v})}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                              <SelectItem value="CC">CC</SelectItem>
                              <SelectItem value="CE">CE</SelectItem>
                              <SelectItem value="NIT">NIT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">Identificación</Label>
                          <Input required value={pseData.id} onChange={e => setPseData({...pseData, id: e.target.value})} className="bg-slate-900 border-slate-700 h-12 rounded-xl" />
                        </div>
                      </div>
                    </div>
                  )}

                  {method === "NEQUI" && (
                    <div className="space-y-4 py-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="w-16 h-16 bg-pink-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-pink-500/20">
                        <Smartphone className="w-8 h-8 text-pink-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-white font-bold text-sm tracking-tight">Número Celular Nequi</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Recibirás un push para autorizar</p>
                      </div>
                      <Input 
                        required 
                        placeholder="300 000 0000" 
                        value={nequiData.phone} 
                        onChange={e => setNequiData({...nequiData, phone: e.target.value})} 
                        className="bg-slate-900 border-slate-700 h-14 text-center text-xl font-mono tracking-[0.2em] rounded-2xl focus:border-pink-500/50 focus:ring-pink-500/10" 
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button 
                    disabled={loading || !method || !email}
                    className={`w-full h-16 text-lg font-black bg-gradient-to-r ${primaryGradient} hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] shadow-xl rounded-2xl transition-all disabled:opacity-30`}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : `Confirmar Pago`}
                  </Button>
                </div>
              </div>
            </form>
          )}

          <div className="p-8 pt-0 flex flex-col items-center">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-6" />
            <div className="flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              <img src="https://wompi.com/assets/img/logo-wompi.png" alt="Wompi" className="h-4" />
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-400 font-black text-[9px] uppercase tracking-tighter">
                <Lock className="w-3 h-3" />
                Secure Payments
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
