import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Upload, Save, Store, Phone, Tag, MapPin, Link, Copy } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "lanches", label: "Lanches" },
  { value: "pizzas", label: "Pizzas" },
  { value: "adegas", label: "Adegas" },
  { value: "japonesa", label: "Japonesa" },
  { value: "saudavel", label: "Saudável" },
  { value: "sobremesas", label: "Sobremesas" },
  { value: "cafeteria", label: "Cafeteria" },
  { value: "churrasco", label: "Churrasco" },
  { value: "farmacias", label: "Farmácias" },
  { value: "docerias", label: "Docerias" },
];

interface StoreSettingsProps {
  storeId: string;
  storeName: string;
  storeCategory: string;
  storeImageUrl: string | null;
  storeIsOpen: boolean;
  forceClosed: boolean;
  storeSlug?: string | null;
}

const StoreSettings = ({ storeId, storeName, storeCategory, storeImageUrl, storeIsOpen, forceClosed, storeSlug }: StoreSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(storeName);
  const [category, setCategory] = useState(storeCategory);
  const [slug, setSlug] = useState(storeSlug || "");
  const [whatsapp, setWhatsapp] = useState("");
  const [imageUrl, setImageUrl] = useState(storeImageUrl || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load whatsapp from profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_number")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_number) setWhatsapp(data.whatsapp_number);
      });
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    // Path: userId/logo_timestamp.ext (matches RLS policy)
    const filePath = `${user.id}/logo_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("store-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Erro ao subir imagem. Verifique sua conexão ou tente um arquivo menor (até 2MB).");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    setImageUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem carregada!");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do estabelecimento é obrigatório.");
      return;
    }
    if (whatsapp && whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("WhatsApp inválido. Mínimo 10 dígitos.");
      return;
    }

    setSaving(true);

    // Update store
    const { error: storeError } = await supabase
      .from("stores")
      .update({
        name: name.trim(),
        category: category as any,
        image_url: imageUrl || null,
      })
      .eq("id", storeId);

    if (storeError) {
      toast.error("Erro ao salvar dados da loja.");
      setSaving(false);
      return;
    }

    // Update whatsapp on profile
    if (user) {
      const cleanWhatsapp = whatsapp.replace(/\D/g, "");
      await supabase
        .from("profiles")
        .update({ whatsapp_number: cleanWhatsapp || null })
        .eq("user_id", user.id);
    }

    queryClient.invalidateQueries({ queryKey: ["my-store"] });
    toast.success("✅ Configurações salvas com sucesso!");
    setSaving(false);
  };

  const formatWhatsapp = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 9) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Logo Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-gray-700 border-4 border-gray-600 overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-10 w-10 text-gray-500" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-transform">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">
          {uploading ? "Enviando..." : "Toque no ícone para alterar a logo"}
        </p>
      </div>

      {/* Store Name */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          Nome do Estabelecimento
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Nata Lanches"
          maxLength={100}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Categoria
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* WhatsApp */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Phone className="h-4 w-4 text-green-400" />
          WhatsApp de Atendimento
        </label>
        <input
          type="tel"
          value={formatWhatsapp(whatsapp)}
          onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
          placeholder="(14) 99999-9999"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
        />
        <p className="text-[10px] text-gray-500">Será exibido para clientes e entregadores.</p>
      </div>

      {/* Store Status Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-bold text-gray-300">Status Atual</p>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${storeIsOpen && !forceClosed ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span className={`text-sm font-bold ${storeIsOpen && !forceClosed ? "text-green-400" : "text-red-400"}`}>
            {storeIsOpen && !forceClosed ? "Loja Aberta" : "Loja Fechada"}
          </span>
        </div>
        <p className="text-[10px] text-gray-500">
          Use o botão "Pausar/Reabrir" no topo do painel para abrir ou fechar a loja manualmente.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <Save className="h-5 w-5" />
        {saving ? "Salvando..." : "Salvar Alterações"}
      </button>
    </div>
  );
};

export default StoreSettings;
