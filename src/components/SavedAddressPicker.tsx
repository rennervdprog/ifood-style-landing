import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Plus, Trash2, Check, Home, Briefcase, MapPinned, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCep, fetchCep } from "@/lib/location";

interface SavedAddress {
  id: string;
  label: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  reference_point: string | null;
  is_default: boolean;
  cep: string | null;
}

interface SavedAddressPickerProps {
  onSelect: (address: SavedAddress) => void;
  selectedId?: string;
}

const labelIcons: Record<string, React.ElementType> = {
  Casa: Home,
  Trabalho: Briefcase,
};

const SavedAddressPicker = ({ onSelect, selectedId }: SavedAddressPickerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Casa");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["saved-addresses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_addresses" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SavedAddress[];
    },
    enabled: !!user,
  });

  const { data: neighborhoods } = useQuery({
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
      toast.error("CEP inválido.");
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
      if (result.bairro) {
        setNeighborhood(result.bairro);
      }
      toast.success("Endereço preenchido!");
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSave = async () => {
    if (!street.trim() || !number.trim() || !neighborhood) {
      toast.error("Preencha rua, número e bairro.");
      return;
    }
    setSaving(true);
    try {
      const isFirst = !addresses || addresses.length === 0;
      const { error } = await supabase.from("saved_addresses" as any).insert({
        user_id: user!.id,
        label,
        cep: cep.replace(/\D/g, "") || null,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        neighborhood,
        reference_point: referencePoint.trim() || null,
        is_default: isFirst,
      });
      if (error) throw error;
      toast.success("Endereço salvo!");
      setShowForm(false);
      setCep("");
      setStreet("");
      setNumber("");
      setComplement("");
      setReferencePoint("");
      setNeighborhood("");
      queryClient.invalidateQueries({ queryKey: ["saved-addresses", user?.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_addresses" as any).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else {
      toast.success("Endereço removido.");
      queryClient.invalidateQueries({ queryKey: ["saved-addresses", user?.id] });
    }
  };

  if (isLoading) return <div className="h-20 bg-muted rounded-xl animate-pulse" />;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <MapPinned className="h-3.5 w-3.5 text-primary" />
        Endereços Salvos
      </h3>

      {addresses?.map((addr) => {
        const Icon = labelIcons[addr.label] || MapPin;
        const isSelected = selectedId === addr.id;
        return (
          <div
            key={addr.id}
            onClick={() => onSelect(addr)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {addr.label} — {addr.street}, {addr.number}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{addr.neighborhood}</p>
            </div>
            {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}
              className="text-muted-foreground hover:text-destructive p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Endereço
        </button>
      ) : (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            {["Casa", "Trabalho", "Outro"].map((l) => (
              <button
                key={l}
                onClick={() => setLabel(l)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  label === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* CEP field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="CEP"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric"
              maxLength={9}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground"
            />
            <button
              onClick={() => handleCepLookup()}
              disabled={loadingCep}
              className="px-2 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {loadingCep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input type="text" placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)}
              className="col-span-2 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground" />
            <input type="text" placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric"
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground" />
          </div>
          <input type="text" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground" />
          <div>
            <label className="text-[10px] font-bold text-muted-foreground mb-0.5 block">Bairro (via CEP)</label>
            <input type="text" placeholder="Preencha o CEP acima" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground" />
          </div>
          <input type="text" placeholder="Ponto de referência" value={referencePoint} onChange={(e) => setReferencePoint(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setCep(""); }} className="flex-1 py-2 rounded-lg border border-border text-xs font-bold text-muted-foreground">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedAddressPicker;
