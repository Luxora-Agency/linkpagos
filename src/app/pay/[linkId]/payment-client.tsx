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

  // Pre-fetch tokens and banks
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
          console.error("Initialization error", e);
        }
      };
      initCheckout();
    }
  }, [step, link.id, link.paymentMethods]);

  const validateCard = () => {
    if (cardData.number.replace(/\s/g, "").length < 15) return "Número de tarjeta inválido";
    if (!cardData.expMonth || cardData.expMonth.length < 2) return "Mes de expiración inválido (MM)";
    if (!cardData.expYear || cardData.expYear.length < 2) return "Año de expiración inválido (YY)";
    if (cardData.cvc.length < 3) return "CVC inválido";
    if (!cardData.name || cardData.name.length < 3) return "Nombre del titular requerido";
    return null;
  };

  const processCardPayment = async () => {
    const error = validateCard();
    if (error) return toast.error(error);
    if (!tokens) return toast.error("Error de conexión segura. Por favor espera...");

    setLoading(true);
    try {
      // 1. Tokenize with Wompi
      const tokenRes = await fetch("https://production.wompi.co/v1/tokens/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.publicKey}` },
        body: JSON.stringify({
          number: cardData.number.replace(/\s/g, ""),
          cvc: cardData.cvc,
          exp_month: cardData.expMonth,
          exp_year: cardData.expYear.length === 2 ? `20${cardData.expYear}` : cardData.expYear,
          card_holder: cardData.name,
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error?.reason || "Datos de tarjeta no válidos");

      // 2. Process in backend
      const res = await fetch(`/api/pay/${link.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: { type: "CARD", token: tokenData.data.id, installments: 1 },
          customerEmail: email,
          acceptanceToken: tokens.acceptance,
          personalDataToken: tokens.personal
        })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Pago procesado correctamente");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error(result.error || "Error en la transacción");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const processPsePayment = async () => {
    if (!pseData.bank) return toast.error("Selecciona un banco");
    if (!pseData.id) return toast.error("Ingresa tu identificación");
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
          acceptanceToken: tokens?.acceptance,
          personalDataToken: tokens?.personal
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
      setLoading(false);
    }
  };

  const processNequiPayment = async () => {
    if (nequiData.phone.length < 10) return toast.error("Número Nequi inválido");
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${link.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: { type: "NEQUI", phone_number: nequiData.phone },
          customerEmail: email,
          acceptanceToken: tokens?.acceptance,
          personalDataToken: tokens?.personal
        })
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Solicitud enviada a Nequi");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(result.error || "Error con Nequi");
      }
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  const handlePayClick = () => {
    if (loading) return;
    if (!email) return toast.error("Por favor ingresa tu email");
    if (method === "CARD") processCardPayment();
    else if (method === "PSE") processPsePayment();
    else if (method === "NEQUI") processNequiPayment();
  };

  // Shared Styles
  const glassBg = "bg-slate-900/95 backdrop-blur-2xl border-slate-800/60";

  if (link.status === "PAID") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${glassBg} border-blue-500/20 shadow-2xl rounded-[2.5rem] overflow-hidden`}>
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
              <CheckCircle className="w-12 h-12 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3">¡Pago Exitoso!</h1>
            <p className="text-slate-400 font-medium">Gracias. Tu transacción ha sido procesada correctamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (link.status === "PROCESSING") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${glassBg} border-blue-500/20 shadow-2xl rounded-[2.5rem]`}>
          <CardContent className="p-12 text-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
              <div className="relative w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border border-blue-500/30">
                <Clock className="w-12 h-12 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white mb-3">Verificando Pago</h1>
            <p className="text-slate-400 mb-8">Estamos confirmando la transacción. Esto solo tomará unos segundos.</p>
            <Button className="w-full bg-blue-600 font-black h-14 rounded-2xl shadow-xl shadow-blue-600/20" onClick={() => window.location.reload()}>Actualizar Estado</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-15%] w-[80%] h-[80%] bg-blue-600/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[80%] h-[80%] bg-indigo-600/5 blur-[140px] rounded-full" />
      </div>

      <Card className={`w-full max-w-md ${glassBg} shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-50 border-t-blue-500 border-t-4 rounded-[3rem] overflow-hidden`}>
        <CardContent className="p-0">
          {step === "overview" ? (
            <div className="p-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-5">
                {link.logoUrl ? (
                  <div className="inline-block p-1.5 bg-white/5 rounded-3xl border border-white/10 shadow-2xl">
                    <img src={link.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <CreditCardIcon className="w-10 h-10 text-blue-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight leading-none">{link.title}</h1>
                  {link.description && <p className="text-blue-200/40 text-sm mt-3 font-medium">{link.description}</p>}
                </div>
              </div>

              <div className="bg-blue-500/5 rounded-[2.5rem] p-10 text-center border border-blue-500/10 shadow-inner">
                <span className="text-[10px] font-black text-blue-400/80 uppercase tracking-[0.3em] mb-3 block">Monto Total</span>
                <div className="text-5xl font-black text-white tracking-tighter mb-1">{formatCurrency(link.amount)}</div>
                {link.amountUsd && <div className="text-sm font-bold text-blue-300/30">≈ {formatUsd(link.amountUsd)} USD</div>}
              </div>

              <div className="space-y-10">
                <div className="flex justify-center gap-6">
                  {link.paymentMethods.map(m => (
                    <div key={m} className="text-slate-600 hover:text-blue-400 transition-colors scale-110">
                      {PAYMENT_METHOD_ICONS[m]}
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => { setStep("checkout"); if(link.paymentMethods.length > 0) setMethod(link.paymentMethods[0]); }}
                  className="w-full h-20 text-xl font-black bg-blue-600 hover:bg-blue-500 text-white shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] rounded-3xl transition-all active:scale-[0.97] flex items-center justify-center gap-3 group"
                >
                  Pagar Ahora
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-slate-600 pt-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Pago Protegido • 256-bit SSL</span>
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-10 fade-in duration-500">
              <div className="p-8 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/60">
                <button onClick={() => setStep("overview")} className="p-3 -ml-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all active:scale-90">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Monto a pagar</p>
                  <p className="text-2xl font-black text-blue-400">{formatCurrency(link.amount)}</p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <Label className="text-blue-400 text-[11px] font-black uppercase tracking-widest ml-1">Medio de Pago</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {link.paymentMethods.map(m => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center justify-center py-5 rounded-3xl border-2 transition-all active:scale-90 ${
                          method === m ? 'border-blue-500 bg-blue-500/20 text-white shadow-2xl' : 'border-slate-800 bg-slate-800/40 text-slate-500'
                        }`}
                      >
                        <div className={method === m ? 'text-blue-400 scale-125' : ''}>{PAYMENT_METHOD_ICONS[m]}</div>
                        <span className="text-[10px] mt-3 font-black uppercase tracking-tighter">{PAYMENT_METHOD_LABELS[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-blue-400 text-[11px] font-black uppercase tracking-widest ml-1">Tu Correo Personal</Label>
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="bg-black border-slate-700 h-16 rounded-2xl text-white text-lg font-bold placeholder:text-slate-800 focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-inner"
                  />
                </div>

                <div className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-800/50 space-y-6">
                  {method === "CARD" && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">Número de Tarjeta</Label>
                        <div className="relative">
                          <Input 
                            placeholder="0000 0000 0000 0000"
                            value={cardData.number}
                            onChange={e => {
                              const v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                              if(v.length <= 19) setCardData({...cardData, number: v})
                            }}
                            className="bg-black border-slate-700 h-16 pl-14 font-mono tracking-[0.2em] text-white text-xl rounded-2xl focus:border-blue-500 shadow-inner"
                          />
                          <CreditCard className="absolute left-5 top-5.5 w-6 h-6 text-blue-500/40" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">Vencimiento</Label>
                          <div className="flex gap-3">
                            <Input placeholder="MM" maxLength={2} value={cardData.expMonth} onChange={e => setCardData({...cardData, expMonth: e.target.value.replace(/\D/g, '')})} className="bg-black border-slate-700 h-14 text-center font-mono text-white text-lg rounded-xl focus:border-blue-500" />
                            <Input placeholder="YY" maxLength={2} value={cardData.expYear} onChange={e => setCardData({...cardData, expYear: e.target.value.replace(/\D/g, '')})} className="bg-black border-slate-700 h-14 text-center font-mono text-white text-lg rounded-xl focus:border-blue-500" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">CVC</Label>
                          <Input type="password" placeholder="***" maxLength={4} value={cardData.cvc} onChange={e => setCardData({...cardData, cvc: e.target.value.replace(/\D/g, '')})} className="bg-black border-slate-700 h-14 text-center font-mono text-white text-lg rounded-xl focus:border-blue-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">Titular de Tarjeta</Label>
                        <Input placeholder="NOMBRE COMO APARECE" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="bg-black border-slate-700 h-14 text-white text-base font-black rounded-xl uppercase px-5 focus:border-blue-500 shadow-inner" />
                      </div>
                    </div>
                  )}

                  {method === "PSE" && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">Selecciona tu Banco</Label>
                        <Select value={pseData.bank} onValueChange={v => setPseData({...pseData, bank: v})}>
                          <SelectTrigger className="bg-black border-slate-700 h-16 text-white rounded-2xl px-5 text-base font-bold shadow-inner">
                            <SelectValue placeholder="Busca tu entidad..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-80">
                            {banks.map(b => (
                              <SelectItem key={b.financial_institution_code} value={b.financial_institution_code} className="py-3 font-medium">
                                {b.financial_institution_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-2">
                          <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">ID</Label>
                          <Select value={pseData.idType} onValueChange={v => setPseData({...pseData, idType: v})}>
                            <SelectTrigger className="bg-black border-slate-700 h-14 text-white rounded-xl font-bold">
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
                          <Label className="text-blue-300 text-[10px] font-black uppercase ml-1 opacity-60">Número de Documento</Label>
                          <Input value={pseData.id} onChange={e => setPseData({...pseData, id: e.target.value})} className="bg-black border-slate-700 h-14 text-white rounded-xl px-5 font-bold shadow-inner" />
                        </div>
                      </div>
                    </div>
                  )}

                  {method === "NEQUI" && (
                    <div className="space-y-6 text-center py-6">
                      <div className="w-24 h-24 bg-pink-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border border-pink-500/20 shadow-2xl shadow-pink-500/10">
                        <Smartphone className="w-12 h-12 text-pink-500" />
                      </div>
                      <p className="text-blue-100 font-bold text-sm">Ingresa el celular asociado a tu cuenta Nequi</p>
                      <Input 
                        placeholder="300 000 0000" 
                        value={nequiData.phone} 
                        onChange={e => setNequiData({...nequiData, phone: e.target.value})} 
                        className="bg-black border-slate-700 h-20 text-center text-3xl font-black tracking-[0.2em] rounded-3xl text-white shadow-inner focus:border-pink-500" 
                      />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handlePayClick}
                  disabled={loading}
                  className={`w-full h-20 text-2xl font-black bg-blue-600 hover:bg-blue-500 text-white shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] rounded-[2rem] transition-all active:scale-95 relative z-50 overflow-hidden group`}
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span>Procesando...</span>
                    </div>
                  ) : (
                    <span>Confirmar Pago</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="p-12 pt-0 flex flex-col items-center">
            <div className="flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
              <img src="https://wompi.com/assets/img/logo-wompi.png" alt="Wompi" className="h-6" />
              <div className="h-6 w-[1px] bg-slate-700" />
              <div className="flex items-center gap-2 text-white font-black text-[11px] uppercase tracking-[0.2em]">
                <Lock className="w-4 h-4" /> Secure
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
