import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface AddressModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const AddressModal = ({ onClose, onSaved }: AddressModalProps) => {
  const { user } = useAuth();
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("neighborhood_fees").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!street.trim() || !number.trim() || !neighborhood) {
      toast.error("Preencha rua, número e bairro.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          reference_point: referencePoint.trim(),
          neighborhood,
          phone: phone.trim(),
        } as any, { onConflict: "user_id" });
      if (error) throw error;
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
          Precisamos do seu endereço para entregar em Itatinga.
        </p>
        <div className="space-y-3">
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
          <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
            <option value="">Selecione o Bairro</option>
            {neighborhoods?.map((n) => (
              <option key={n.id} value={n.name}>{n.name}</option>
            ))}
          </select>
          <input type="text" placeholder="Ponto de referência" value={referencePoint} onChange={(e) => setReferencePoint(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="tel" placeholder="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
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
