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
  CreditCardIcon,
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
      const initCheckout = async () => {
        try {
          const res = await fetch(`/api/pay/${link.id}`);
          const data = await res.json();
          if (res.ok) {
            setTokens(data);
            if (link.paymentMethods.includes("PSE")) {
              const banksRes = await fetch("https://production.wompi.co/v1/pse/financial_institutions", {
                headers: { Authorization: `Bearer ${data.publicKey}` }
              });
              const banksData = await banksRes.json();
              if (banksData.data) setBanks(banksData.data);
            }
          }
        } catch (e) {
          console.error("Error init checkout", e);
        }
      };
      initCheckout();
    }
  }, [step, link.id, link.paymentMethods]);

  const processCardPayment = async () => {
    if (!tokens) return toast.error("Configurando conexión segura... Reintenta en un segundo.");
    
    // Basic validation before calling Wompi
    if (cardData.number.replace(/\s/g, "").length < 15) return toast.error("Número de tarjeta incompleto");
    if (!cardData.expMonth || !cardData.expYear) return toast.error("Fecha de expiración necesaria");
    if (cardData.cvc.length < 3) return toast.error("Código CVC necesario");
    if (!cardData.name) return toast.error("Nombre del titular necesario");

    setLoading(true);
    try {
      // 1. Tokenize Card with Wompi
      const tokenRes = await fetch("https://production.wompi.co/v1/tokens/cards", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.publicKey}` 
        },
        body: JSON.stringify({
          number: cardData.number.replace(/\s/g, ""),
          cvc: cardData.cvc,
          exp_month: cardData.expMonth.padStart(2, '0'),
          exp_year: cardData.expYear.length === 2 ? `20${cardData.expYear}` : cardData.expYear,
          card_holder: cardData.name,
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error?.reason || "Datos de tarjeta no válidos");
      }

      // 2. Process transaction in our backend
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
        toast.success("Transacción iniciada exitosamente");
        setTimeout(() => window.location.reload(), 1000);
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
    if (!pseData.bank) return toast.error("Selecciona tu banco");
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
        throw new Error(result.error || "Error al conectar con PSE");
      }
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  const processNequiPayment = async () => {
    if (!tokens) return;
    if (nequiData.phone.length < 10) return toast.error("Número de Nequi inválido");
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
        toast.success("Solicitud enviada a tu celular");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(result.error || "Error con Nequi");
      }
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  const handleFinalAction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    
    if (!method) return toast.error("Elige un medio de pago");
    if (!email) return toast.error("El correo es obligatorio");

    if (method === "CARD") processCardPayment();
    else if (method === "PSE") processPsePayment();
    else if (method === "NEQUI") processNequiPayment();
  };

  // UI Components
  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-blue-500/30 shadow-2xl rounded-3xl overflow-hidden">
          <div className="h-2 bg-blue-500" />
          <CardContent className="p-10 text-center">
            <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
              <CheckCircle className="w-12 h-12 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">¡Pago Exitoso!</h1>
            <p className="text-slate-400">Tu transacción se ha completado correctamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "PROCESSING") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-blue-500/30 shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="p-10 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border border-blue-500/30">
                <Clock className="w-12 h-12 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Validando Pago</h1>
            <p className="text-slate-400">Estamos confirmando tu transacción. Esto tomará solo unos segundos.</p>
            <Button className="mt-8 w-full bg-blue-600 hover:bg-blue-700 font-bold" onClick={() => window.location.reload()}>Actualizar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 font-sans selection:bg-blue-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <Card className="w-full max-w-md bg-slate-900/95 backdrop-blur-3xl border-slate-800/60 shadow-[0_0_60px_rgba(0,0,0,0.6)] relative z-10 border-t-blue-500 border-t-4 rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          {step === "overview" ? (
            <div className="p-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-5">
                {link.logoUrl ? (
                  <div className="inline-block p-1.5 bg-white/5 rounded-3xl border border-white/10">
                    <img src={link.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20">
                    <CreditCardIcon className="w-10 h-10 text-blue-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">{link.title}</h1>
                  {link.description && <p className="text-slate-400 text-sm mt-2">{link.description}</p>}
                </div>
              </div>

              <div className="bg-blue-500/5 rounded-[2rem] p-10 text-center border border-blue-500/10">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Monto a pagar</span>
                <div className="text-5xl font-black text-white tracking-tighter">{formatCurrency(link.amount)}</div>
                {link.amountUsd && <div className="text-sm font-semibold text-blue-300/40 mt-3">≈ {formatUsd(link.amountUsd)} USD</div>}
              </div>

              <Button 
                onClick={() => { setStep("checkout"); if(link.paymentMethods.length > 0) setMethod(link.paymentMethods[0]); }}
                className="w-full h-16 text-lg font-black bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/20 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Pagar Ahora
                <ChevronRight className="w-5 h-5" />
              </Button>

              <div className="flex items-center justify-center gap-2 text-slate-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Pago Seguro via Wompi</span>
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="p-6 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/40">
                <button type="button" onClick={() => setStep("overview")} className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-400">{formatCurrency(link.amount)}</p>
                </div>
              </div>

              <form onSubmit={handleFinalAction} className="p-8 space-y-6">
                <div className="space-y-3">
                  <Label className="text-blue-400 text-[11px] font-black uppercase tracking-widest ml-1">Medio de Pago</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {link.paymentMethods.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center justify-center py-4 rounded-2xl border-2 transition-all active:scale-90 ${
                          method === m ? 'border-blue-500 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className={method === m ? 'text-blue-400 scale-110' : ''}>{PAYMENT_METHOD_ICONS[m]}</div>
                        <span className="text-[10px] mt-2 font-black uppercase tracking-tighter">{PAYMENT_METHOD_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-400 text-[11px] font-black uppercase tracking-widest ml-1">Email de Notificación</Label>
                  <Input 
                    required 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-slate-950 border-slate-700 h-14 rounded-2xl text-white text-base font-medium placeholder:text-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-800/50 space-y-5">
                  {method === "CARD" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-blue-300 text-[10px] uppercase font-black ml-1">Número de Tarjeta</Label>
                        <div className="relative">
                          <Input 
                            required 
                            placeholder="0000 0000 0000 0000"
                            value={cardData.number}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                              if(v.length <= 19) setCardData({...cardData, number: v})
                            }}
                            className="bg-slate-950 border-slate-700 h-14 pl-12 font-mono tracking-[0.15em] text-white text-lg rounded-xl focus:border-blue-500"
                          />
                          <CreditCard className="absolute left-4 top-4.5 w-5 h-5 text-blue-500/50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-blue-300 text-[10px] uppercase font-black ml-1">Expiración</Label>
                          <div className="flex gap-2">
                            <Input required placeholder="MM" maxLength={2} value={cardData.expMonth} onChange={e => setCardData({...cardData, expMonth: e.target.value.replace(/\D/g, '')})} className="bg-slate-950 border-slate-700 h-12 text-center font-mono text-white text-base rounded-xl focus:border-blue-500" />
                            <Input required placeholder="YY" maxLength={2} value={cardData.expYear} onChange={e => setCardData({...cardData, expYear: e.target.value.replace(/\D/g, '')})} className="bg-slate-950 border-slate-700 h-12 text-center font-mono text-white text-base rounded-xl focus:border-blue-500" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-blue-300 text-[10px] uppercase font-black ml-1">CVC</Label>
                          <Input required type="password" placeholder="***" maxLength={4} value={cardData.cvc} onChange={e => setCardData({...cardData, cvc: e.target.value.replace(/\D/g, '')})} className="bg-slate-950 border-slate-700 h-12 text-center font-mono text-white text-base rounded-xl focus:border-blue-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-300 text-[10px] uppercase font-black ml-1">Titular</Label>
                        <Input required placeholder="COMO APARECE EN LA TARJETA" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="bg-slate-950 border-slate-700 h-12 text-white text-sm font-bold rounded-xl uppercase px-4 focus:border-blue-500" />
                      </div>
                    </div>
                  )}

                  {method === "PSE" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-blue-300/60 text-[9px] uppercase font-bold ml-1">Banco</Label>
                        <Select value={pseData.bank} onValueChange={v => setPseData({...pseData, bank: v})}>
                          <SelectTrigger className="bg-slate-950 border-slate-700 h-14 text-white rounded-xl">
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
                          <Label className="text-blue-300/60 text-[9px] uppercase font-bold ml-1">Tipo</Label>
                          <Select value={pseData.idType} onValueChange={v => setPseData({...pseData, idType: v})}>
                            <SelectTrigger className="bg-slate-950 border-slate-700 h-14 text-white rounded-xl">
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
                          <Label className="text-blue-300/60 text-[9px] uppercase font-bold ml-1">Número ID</Label>
                          <Input required value={pseData.id} onChange={e => setPseData({...pseData, id: e.target.value})} className="bg-slate-950 border-slate-700 h-14 text-white rounded-xl px-4" />
                        </div>
                      </div>
                    </div>
                  )}

                  {method === "NEQUI" && (
                    <div className="space-y-4 text-center py-4">
                      <div className="w-20 h-20 bg-pink-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2 border border-pink-500/20">
                        <Smartphone className="w-10 h-10 text-pink-500" />
                      </div>
                      <p className="text-blue-200/60 text-xs font-medium">Celular vinculado a Nequi</p>
                      <Input 
                        required 
                        placeholder="300 000 0000" 
                        value={nequiData.phone} 
                        onChange={e => setNequiData({...nequiData, phone: e.target.value})} 
                        className="bg-slate-950 border-slate-700 h-16 text-center text-2xl font-bold tracking-[0.2em] rounded-2xl text-white" 
                      />
                    </div>
                  )}
                </div>

                <Button 
                  type="submit"
                  disabled={loading || !method || !email}
                  className="w-full h-16 text-xl font-black bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 rounded-2xl transition-all active:scale-[0.98] relative z-20 touch-manipulation flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : `Confirmar Pago`}
                </Button>
              </form>
            </div>
          )}

          <div className="p-10 pt-0 flex flex-col items-center">
            <div className="flex items-center gap-5 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
              <img src="https://wompi.com/assets/img/logo-wompi.png" alt="Wompi" className="h-5" />
              <div className="h-5 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest">
                <Lock className="w-3.5 h-3.5" /> 256-BIT SSL
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}