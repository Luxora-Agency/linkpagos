"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Copy,
  ImagePlus,
  X,
  RefreshCw,
  Eye,
} from "lucide-react";

interface PaymentLink {
  id: string;
  provider: "BOLD" | "WOMPI";
  providerLinkId: string | null;
  providerUrl: string | null;
  title: string;
  description: string | null;
  amount: number;
  amountType: string;
  logoUrl: string | null;
  status: "ACTIVE" | "PROCESSING" | "PAID" | "EXPIRED";
  expirationDate: string | null;
  paymentMethods: string[];
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

const PAYMENT_METHODS_WOMPI = [
  { id: "CARD", label: "Tarjeta de Credito/Debito" },
  { id: "PSE", label: "PSE" },
  { id: "NEQUI", label: "Nequi" },
  { id: "BANCOLOMBIA_TRANSFER", label: "Transferencia Bancolombia" },
];

const PAYMENT_METHODS_BOLD = [
  { id: "CREDIT_CARD", label: "Tarjeta de Credito" },
  { id: "PSE", label: "PSE" },
  { id: "NEQUI", label: "Nequi" },
  { id: "BOTON_BANCOLOMBIA", label: "Boton Bancolombia" },
];

export default function LinksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    amountType: "CLOSE",
    logoUrl: "",
    expirationDate: "",
    paymentMethods: ["CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"],
    provider: "WOMPI" as "BOLD" | "WOMPI",
  });

  const currentPaymentMethods = formData.provider === "WOMPI"
    ? PAYMENT_METHODS_WOMPI
    : PAYMENT_METHODS_BOLD;

  const fetchLinks = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (providerFilter !== "all") {
        params.set("provider", providerFilter);
      }

      const res = await fetch(`/api/links?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.data);
      }
    } catch (error) {
      console.error("Error fetching links:", error);
      toast.error("Error al cargar links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [statusFilter, providerFilter]);

  const handleProviderChange = (provider: "BOLD" | "WOMPI") => {
    const defaultMethods = provider === "WOMPI"
      ? ["CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"]
      : ["CREDIT_CARD", "PSE", "NEQUI", "BOTON_BANCOLOMBIA"];

    setFormData({
      ...formData,
      provider,
      paymentMethods: defaultMethods,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          amount: parseInt(formData.amount),
          amountType: formData.amountType,
          expirationDate: formData.expirationDate ? new Date(formData.expirationDate).toISOString() : null,
          logoUrl: formData.logoUrl || null,
          paymentMethods: formData.paymentMethods,
          provider: formData.provider,
        }),
      });

      if (res.ok) {
        toast.success("Link de pago creado exitosamente");
        setIsDialogOpen(false);
        resetForm();
        fetchLinks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear link");
      }
    } catch (error) {
      console.error("Error creating link:", error);
      toast.error("Error al crear link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      amount: "",
      amountType: "CLOSE",
      logoUrl: "",
      expirationDate: "",
      paymentMethods: ["CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"],
      provider: "WOMPI",
    });
  };

  const handleDelete = async (link: PaymentLink) => {
    if (!confirm(`¿Estas seguro de eliminar el link "${link.title}"?`)) return;

    try {
      const res = await fetch(`/api/links/${link.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Link eliminado");
        fetchLinks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar link");
      }
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("Error al eliminar link");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, logoUrl: data.url });
        toast.success("Logo subido exitosamente");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al subir logo");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error al subir logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado al portapapeles");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
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
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getProviderBadge = (provider: string) => {
    const styles: Record<string, string> = {
      BOLD: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      WOMPI: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };

    return (
      <Badge variant="outline" className={styles[provider]}>
        {provider}
      </Badge>
    );
  };

  const filteredLinks = links.filter(
    (link) =>
      link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.providerLinkId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePaymentMethod = (method: string) => {
    const methods = formData.paymentMethods.includes(method)
      ? formData.paymentMethods.filter((m) => m !== method)
      : [...formData.paymentMethods, method];
    setFormData({ ...formData, paymentMethods: methods });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Links de Pago</h1>
          <p className="text-slate-400 mt-1">
            Crea y gestiona tus links de pago con Bold o Wompi
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={resetForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Link
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">
                Crear Link de Pago
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Selecciona el proveedor y completa los datos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider Selector */}
              <div className="space-y-2">
                <Label className="text-slate-300">Proveedor de Pagos *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("WOMPI")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.provider === "WOMPI"
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-700 bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-2xl font-bold text-emerald-400">Wompi</div>
                      <span className="text-xs text-slate-400">
                        Tarjeta, PSE, Nequi, Bancolombia
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange("BOLD")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.provider === "BOLD"
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-slate-700 bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-2xl font-bold text-orange-400">Bold</div>
                      <span className="text-xs text-slate-400">
                        Tarjeta, PSE, Nequi, Bancolombia
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-slate-300">
                    Titulo *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Ej: Pago de servicio"
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-slate-300">
                    Monto (COP) *
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1000"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="10000"
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-300">
                  Descripcion
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descripcion del pago (max 100 caracteres)"
                  maxLength={100}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Logo (opcional)</Label>
                <div className="flex items-center gap-4">
                  {formData.logoUrl ? (
                    <div className="relative">
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        className="w-20 h-20 object-cover rounded-lg border border-slate-700"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 rounded-full"
                        onClick={() => setFormData({ ...formData, logoUrl: "" })}
                      >
                        <X className="h-3 w-3 text-white" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      {uploading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Subiendo..." : "Subir Logo"}
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDate" className="text-slate-300">
                  Fecha de expiracion (opcional)
                </Label>
                <Input
                  id="expirationDate"
                  type="datetime-local"
                  value={formData.expirationDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expirationDate: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300">Metodos de pago</Label>
                <div className="grid grid-cols-2 gap-3">
                  {currentPaymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={method.id}
                        checked={formData.paymentMethods.includes(method.id)}
                        onCheckedChange={() => togglePaymentMethod(method.id)}
                        className="border-slate-600 data-[state=checked]:bg-purple-500"
                      />
                      <label
                        htmlFor={method.id}
                        className="text-sm text-slate-300 cursor-pointer"
                      >
                        {method.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || formData.paymentMethods.length === 0}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isSubmitting ? "Creando..." : "Crear Link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar links..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="WOMPI">Wompi</SelectItem>
                <SelectItem value="BOLD">Bold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="PAID">Pagados</SelectItem>
                <SelectItem value="EXPIRED">Expirados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No se encontraron links de pago
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                  <TableHead className="text-slate-400">Titulo</TableHead>
                  <TableHead className="text-slate-400">Proveedor</TableHead>
                  <TableHead className="text-slate-400">Monto</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400">Creado</TableHead>
                  {(session?.user?.role === "SUPERADMIN" ||
                    session?.user?.role === "ADMIN") && (
                    <TableHead className="text-slate-400">Creador</TableHead>
                  )}
                  <TableHead className="text-slate-400 text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link) => (
                  <TableRow
                    key={link.id}
                    className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => router.push(`/links/${link.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {link.logoUrl && (
                          <img
                            src={link.logoUrl}
                            alt={link.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-white">{link.title}</p>
                          <p className="text-xs text-slate-500">
                            {link.providerLinkId || link.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getProviderBadge(link.provider)}</TableCell>
                    <TableCell className="text-slate-300">
                      {formatCurrency(link.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(link.status)}</TableCell>
                    <TableCell className="text-slate-300">
                      {new Date(link.createdAt).toLocaleDateString("es-CO")}
                    </TableCell>
                    {(session?.user?.role === "SUPERADMIN" ||
                      session?.user?.role === "ADMIN") && (
                      <TableCell className="text-slate-300">
                        {link.user.name}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/links/${link.id}`)}
                          className="text-slate-400 hover:text-white"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {link.providerUrl && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(link.providerUrl!)}
                              className="text-slate-400 hover:text-white"
                              title="Copiar link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(link.providerUrl!, "_blank")
                              }
                              className="text-slate-400 hover:text-white"
                              title="Abrir link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {link.status !== "PAID" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(link)}
                            className="text-slate-400 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
