import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Save, ArrowLeft, Search, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { formatCep, fetchCep, readGpsFromGesture, reverseGeocode } from "@/lib/location";
import { maskWhatsApp } from "@/lib/whatsapp";

interface AddressModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const AddressModal = ({ onClose, onSaved }: AddressModalProps) => {
  const { user } = useAuth();
  const { setNeighborhood } = useCart();
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [neighborhood, setNeighborhoodLocal] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [showGpsHint, setShowGpsHint] = useState(false);

  const { data: neighborhoodFees } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: async () => {
      const { data } = await supabase.from("neighborhood_fees").select("*").order("name");
      return data || [];
    },
  });

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      handleCepLookup(digits);
    }
  };

  const handleCepLookup = async (digits?: string) => {
    const cepDigits = digits || cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      toast.error("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setLoadingCep(true);
    try {
      const result = await fetchCep(cepDigits);
      if (!result) {
        toast.error("CEP não encontrado.");
        return;
      }
      setStreet(result.logradouro || "");
      if (result.complemento) setComplement(result.complemento);
      if (result.bairro) setNeighborhoodLocal(result.bairro);
      if (!result.logradouro && !result.bairro) {
        setShowGpsHint(true);
        toast.info("CEP genérico — use o GPS para preencher com precisão.");
      } else {
        setShowGpsHint(false);
        toast.success("Endereço preenchido pelo CEP!");
      }
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleUseGps = () => {
    const gpsPromise = readGpsFromGesture();
    setLoadingGps(true);
    gpsPromise.then(async (gps) => {
      try {
      if (!gps?.coords) {
        toast.error(gps?.error || "Não foi possível obter a localização. Verifique a permissão de GPS.");
        return;
      }
      const rev = await reverseGeocode(gps.coords);
      if (!rev) {
        toast.error("Localização obtida, mas não foi possível identificar o endereço.");
        return;
      }
      if (rev.street) setStreet(rev.street);
      if (rev.number) setNumber(String(rev.number));
      if (rev.neighborhood) setNeighborhoodLocal(rev.neighborhood);
      if (rev.postalcode && !cep) setCep(formatCep(rev.postalcode));
      setShowGpsHint(false);
      toast.success("Endereço preenchido pelo GPS! Confira e ajuste se necessário.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao usar GPS.");
    } finally {
      setLoadingGps(false);
    }
    });
  };

  const handleSave = async () => {
    if (!street.trim() || !number.trim() || !neighborhood.trim()) {
      toast.error("Preencha rua, número e bairro (use o CEP).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          cep: cep.replace(/\D/g, "") || null,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          reference_point: referencePoint.trim(),
          neighborhood: neighborhood.trim(),
          phone: phone.trim(),
        } as any, { onConflict: "user_id" });
      if (error) throw error;

      // Sync cart neighborhood fee
      if (neighborhoodFees) {
        const match = neighborhoodFees.find((n: any) => n.name.toLowerCase() === neighborhood.trim().toLowerCase());
        if (match) {
          setNeighborhood(match.name, match.fee);
        }
      }

      toast.success("Endereço salvo!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Complete seu Endereço
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Digite seu CEP para preencher automaticamente o endereço e bairro.
        </p>
        <div className="space-y-3">
          {/* CEP field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="CEP (ex: 18690-000)"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric"
              maxLength={9}
              className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => handleCepLookup()}
              disabled={loadingCep}
              className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>

          {showGpsHint && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs text-foreground/80">
                Este CEP é genérico da cidade. Use o GPS para preencher rua e bairro com precisão.
              </p>
              <button
                type="button"
                onClick={handleUseGps}
                disabled={loadingGps}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
              >
                {loadingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                {loadingGps ? "Obtendo localização..." : "Usar minha localização (GPS)"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input type="text" placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="street-address" />
            </div>
            <input type="text" placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <input type="text" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          
          {/* Bairro auto-preenchido pelo CEP */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Bairro</label>
            <input
              type="text"
              placeholder="Digite seu bairro"
              value={neighborhood}
              onChange={(e) => setNeighborhoodLocal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <input type="text" placeholder="Ponto de referência" value={referencePoint} onChange={(e) => setReferencePoint(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input 
            type="tel" 
            placeholder="Telefone / WhatsApp (ex: 14 99999-9999)" 
            value={phone} 
            onChange={(e) => setPhone(maskWhatsApp(e.target.value))} 
            inputMode="tel"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="tel" />
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar e Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressModal;
