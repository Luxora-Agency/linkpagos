"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  // Fetch tokens and banks when entering checkout
  useEffect(() => {
    if (step === "checkout") {
      const initCheckout = async () => {
        try {
          const res = await fetch(`/api/pay/${link.id}`);
          const data = await res.json();
          if (res.ok) {
            setTokens(data);
            // Fetch banks after getting the public key
            if (link.paymentMethods.includes("PSE")) {
              const banksRes = await fetch("https://production.wompi.co/v1/pse/financial_institutions", {
                headers: { Authorization: `Bearer ${data.publicKey}` }
              });
              const banksData = await banksRes.json();
              if (banksData.data) setBanks(banksData.data);
            }
          } else {
            toast.error("Error al inicializar el pago");
          }
        } catch (e) {
          console.error("Error init checkout", e);
        }
      };
      initCheckout();
    }
  }, [step, link.id, link.paymentMethods]);

  const processCardPayment = async () => {
    if (!tokens) return toast.error("Cargando seguridad...");
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
      if (!tokenRes.ok) throw new Error(tokenData.error?.message || "Datos de tarjeta inválidos");

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
        toast.success("Pago procesado correctamente");
        window.location.reload();
      } else {
        throw new Error(result.error || "Error al procesar el pago");
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
        throw new Error(result.error || "Error al iniciar PSE");
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
        toast.success("Notificación enviada a tu Nequi");
        window.location.reload();
      } else {
        throw new Error(result.error || "Error al procesar Nequi");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit triggered for method:", method);
    if (!method) return toast.error("Selecciona un método de pago");
    if (!email) return toast.error("Ingresa tu correo electrónico");

    if (method === "CARD") processCardPayment();
    else if (method === "PSE") processPsePayment();
    else if (method === "NEQUI") processNequiPayment();
  };

  const primaryGradient = "from-blue-600 to-indigo-600";
  const glassEffect = "bg-slate-900/90 backdrop-blur-2xl border-slate-800/50";

  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${glassEffect} border-blue-500/20 shadow-2xl`}>
          <CardContent className="p-10 text-center">
            <CheckCircle className="w-20 h-20 text-blue-400 mx-auto mb-6" />
            <h1 className="text-3xl font-black text-white mb-2">¡Pago Completado!</h1>
            <p className="text-slate-400">Tu transacción fue exitosa.</p>
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
            <Clock className="w-20 h-20 text-blue-400 mx-auto mb-6 animate-pulse" />
            <h1 className="text-2xl font-bold text-white mb-2">Estamos procesando tu pago</h1>
            <p className="text-slate-400">Esto tomará solo un momento. No cierres esta ventana.</p>
            <Button className="mt-8 w-full bg-blue-600" onClick={() => window.location.reload()}>Actualizar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-4 selection:bg-blue-500/30 font-sans">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <Card className={`w-full max-w-md ${glassEffect} shadow-2xl relative z-10 border-t-blue-500 border-t-4 overflow-hidden rounded-3xl`}>
        <CardContent className="p-0">
          {step === "overview" ? (
            <div className="p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-4">
                {link.logoUrl ? (
                  <div className="inline-block p-1 bg-white/5 rounded-3xl border border-white/10 shadow-xl">
                    <img src={link.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20">
                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight leading-tight">{link.title}</h1>
                  {link.description && <p className="text-slate-400 text-sm mt-2">{link.description}</p>}
                </div>
              </div>

              <div className="bg-slate-800/40 rounded-3xl p-8 text-center border border-slate-700/50 shadow-inner">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Monto a pagar</span>
                <div className="text-5xl font-black text-white mt-2 tracking-tighter">{formatCurrency(link.amount)}</div>
                {link.amountUsd && <div className="text-sm font-medium text-slate-500 mt-2">≈ {formatUsd(link.amountUsd)} USD</div>}
              </div>

              <div className="space-y-4 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Métodos de pago seguros</span>
                <div className="flex justify-center gap-4">
                  {link.paymentMethods.map(m => (
                    <div key={m} className="w-12 h-12 flex items-center justify-center bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400">
                      {PAYMENT_METHOD_ICONS[m]}
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => { setStep("checkout"); if(link.paymentMethods.length > 0) setMethod(link.paymentMethods[0]); }}
                className={`w-full h-16 text-lg font-black bg-gradient-to-r ${primaryGradient} shadow-xl rounded-2xl transition-all active:scale-[0.98] group`}
              >
                Continuar al Pago
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Pago Protegido por Wompi</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <button type="button" onClick={() => setStep("overview")} className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total</p>
                  <p className="text-xl font-black text-blue-400">{formatCurrency(link.amount)}</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <Label className="text-slate-400 text-[10px] font-black uppercase tracking-widest">¿Cómo deseas pagar?</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {link.paymentMethods.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                          method === m ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-slate-800 bg-slate-800/30 text-slate-500'
                        }`}
                      >
                        {PAYMENT_METHOD_ICONS[m]}
                        <span className="text-[9px] mt-2 font-black uppercase tracking-tighter">{PAYMENT_METHOD_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tu Correo Electrónico</Label>
                  <Input 
                    required 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-slate-800/50 border-slate-700 h-14 rounded-2xl focus:ring-blue-500/20 text-white"
                  />
                </div>

                <div className="bg-slate-800/30 p-6 rounded-3xl border border-slate-800/50 space-y-5">
                  {method === "CARD" && (
                    <div className="space-y-4">
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
                            className="bg-slate-900 border-slate-700 h-12 pl-11 font-mono tracking-widest text-white"
                          />
                          <CreditCard className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">Expira (MM/YY)</Label>
                          <div className="flex gap-2">
                            <Input required placeholder="MM" maxLength={2} value={cardData.expMonth} onChange={e => setCardData({...cardData, expMonth: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono text-white" />
                            <Input required placeholder="YY" maxLength={2} value={cardData.expYear} onChange={e => setCardData({...cardData, expYear: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono text-white" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">CVC</Label>
                          <Input required type="password" placeholder="***" maxLength={4} value={cardData.cvc} onChange={e => setCardData({...cardData, cvc: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-center font-mono text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-500 text-[9px] uppercase font-bold">Titular de la Tarjeta</Label>
                        <Input required placeholder="NOMBRE COMPLETO" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="bg-slate-900 border-slate-700 h-12 text-white" />
                      </div>
                    </div>
                  )}

                  {method === "PSE" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-500 text-[9px] uppercase font-bold">Banco</Label>
                        <Select value={pseData.bank} onValueChange={v => setPseData({...pseData, bank: v})}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white rounded-xl">
                            <SelectValue placeholder="Selecciona tu banco" />
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
                        <div className="col-span-1 space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">ID</Label>
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
                        <div className="col-span-2 space-y-2">
                          <Label className="text-slate-500 text-[9px] uppercase font-bold">Número de Identificación</Label>
                          <Input required value={pseData.id} onChange={e => setPseData({...pseData, id: e.target.value})} className="bg-slate-900 border-slate-700 h-12 text-white rounded-xl" />
                        </div>
                      </div>
                    </div>
                  )}

                  {method === "NEQUI" && (
                    <div className="space-y-4 text-center py-4">
                      <div className="w-16 h-16 bg-pink-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-pink-500/20">
                        <Smartphone className="w-8 h-8 text-pink-500" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">Ingresa tu número de celular Nequi</p>
                      <Input 
                        required 
                        placeholder="300 000 0000" 
                        value={nequiData.phone} 
                        onChange={e => setNequiData({...nequiData, phone: e.target.value})} 
                        className="bg-slate-900 border-slate-700 h-14 text-center text-xl font-bold tracking-[0.2em] rounded-2xl text-white" 
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit"
                    disabled={loading || !method || !email}
                    className={`w-full h-16 text-lg font-black bg-gradient-to-r ${primaryGradient} shadow-blue-500/20 shadow-xl rounded-2xl transition-all disabled:opacity-30`}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : `Confirmar Pago`}
                  </Button>
                </div>
              </div>
            </form>
          )}

          <div className="p-8 pt-0 flex flex-col items-center">
            <div className="flex items-center gap-4 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              <img src="https://wompi.com/assets/img/logo-wompi.png" alt="Wompi" className="h-4" />
              <div className="h-4 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                <Lock className="w-3 h-3" /> Secure Payment
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}