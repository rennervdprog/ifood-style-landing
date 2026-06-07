/**
 * AppStorePageAdmin — Aba no SuperAdmin para gerenciar a página de download
 * Gerencia: nome, tagline, descrição, versão, APK URL, screenshots, permissões, novidades
 */
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import { toast } from "sonner";
import {
  Smartphone, Save, Loader2, Plus, Trash2, Eye,
  ExternalLink, Upload, Bell, Wifi, MapPin, Camera,
  Mic, Image, GripVertical, Check,
} from "lucide-react";

const PERM_ICON_OPTIONS = [
  { value: "bell",    label: "Notificações" },
  { value: "mic",     label: "Áudio/Microfone" },
  { value: "map-pin", label: "Localização" },
  { value: "wifi",    label: "Internet" },
  { value: "camera",  label: "Câmera" },
  { value: "smartphone", label: "Dispositivo" },
];

interface AppData {
  id?: string;
  app_name: string;
  tagline: string;
  description: string;
  version: string;
  size_mb: string;
  rating: number;
  downloads: string;
  is_published: boolean;
  apk_url: string;
  play_store_url: string;
  icon_url: string;
  screenshots: { url: string; caption: string }[];
  permissions: { icon: string; title: string; desc: string }[];
  whats_new: string;
  developer: string;
  category: string;
}

const DEFAULT: AppData = {
  app_name: "ItaSuper Parceiro",
  tagline: "Gerencie sua loja e entregas com total controle",
  description: "",
  version: APP_VERSION,
  size_mb: "28 MB",
  rating: 5.0,
  downloads: "500+",
  is_published: true,
  apk_url: "",
  play_store_url: "",
  icon_url: "/icon-parceiro.png",
  screenshots: [],
  permissions: [
    { icon: "bell",    title: "Notificações", desc: "Para alertar sobre novos pedidos em tempo real" },
    { icon: "mic",     title: "Áudio",        desc: "Para tocar o alerta sonoro de novos pedidos" },
    { icon: "map-pin", title: "Localização",  desc: "Para calcular distâncias de entrega (opcional)" },
    { icon: "wifi",    title: "Internet",     desc: "Para sincronizar pedidos e dados da loja" },
    { icon: "camera",  title: "Câmera",       desc: "Para adicionar fotos ao cardápio (opcional)" },
  ],
  whats_new: "",
  developer: "ItaSuper",
  category: "Negócios",
};

const AppStorePageAdmin = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppData>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [newScreenUrl, setNewScreenUrl] = useState("");
  const [newScreenCaption, setNewScreenCaption] = useState("");

  const { data: dbData, isLoading } = useQuery({
    queryKey: ["app-store-page-admin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("app_store_page")
        .select("*")
        .eq("app_type", "parceiro")
        .maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (dbData) {
      setForm({
        ...DEFAULT,
        ...dbData,
        screenshots: dbData.screenshots || [],
        permissions: dbData.permissions || DEFAULT.permissions,
      });
    }
  }, [dbData]);

  const f = (field: keyof AppData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, app_type: "parceiro", updated_at: new Date().toISOString() };
      const { error } = await (supabase as any)
        .from("app_store_page")
        .upsert(payload, { onConflict: "app_type" });
      if (error) throw error;
      toast.success("Página atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["app-store-page-admin"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addScreenshot = () => {
    if (!newScreenUrl.trim()) return;
    setForm(prev => ({
      ...prev,
      screenshots: [...prev.screenshots, { url: newScreenUrl.trim(), caption: newScreenCaption.trim() }],
    }));
    setNewScreenUrl("");
    setNewScreenCaption("");
  };

  const removeScreenshot = (i: number) => {
    setForm(prev => ({ ...prev, screenshots: prev.screenshots.filter((_, idx) => idx !== i) }));
  };

  const updatePerm = (i: number, field: keyof typeof DEFAULT.permissions[0], value: string) => {
    setForm(prev => {
      const perms = [...prev.permissions];
      perms[i] = { ...perms[i], [field]: value };
      return { ...prev, permissions: perms };
    });
  };

  const addPerm = () => {
    setForm(prev => ({
      ...prev,
      permissions: [...prev.permissions, { icon: "bell", title: "", desc: "" }],
    }));
  };

  const removePerm = (i: number) => {
    setForm(prev => ({ ...prev, permissions: prev.permissions.filter((_, idx) => idx !== i) }));
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6 p-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-black text-foreground">Página de Download</h2>
            <p className="text-xs text-muted-foreground">Gerencie o conteúdo da página /download</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/download" target="_blank"
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted/40 border border-border px-3 py-2 rounded-xl hover:text-foreground transition-colors">
            <Eye className="h-3.5 w-3.5" /> Ver página
          </a>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Publicado toggle */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl px-4 py-3">
        <div>
          <p className="text-sm font-bold text-foreground">Página publicada</p>
          <p className="text-xs text-muted-foreground">Controla se a página /download está visível</p>
        </div>
        <button
          onClick={() => setForm(prev => ({ ...prev, is_published: !prev.is_published }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.is_published ? "bg-primary" : "bg-muted-foreground/30"}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_published ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Seção 1: Identidade */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Identidade do App</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Nome do App</label>
            <input value={form.app_name} onChange={f("app_name")}
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Desenvolvedor</label>
            <input value={form.developer} onChange={f("developer")}
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Tagline (frase curta)</label>
          <input value={form.tagline} onChange={f("tagline")} maxLength={80}
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">URL do ícone</label>
          <input value={form.icon_url} onChange={f("icon_url")} placeholder="/icon-parceiro.png"
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Categoria</label>
            <input value={form.category} onChange={f("category")}
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Downloads</label>
            <input value={form.downloads} onChange={f("downloads")} placeholder="500+"
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
      </div>

      {/* Seção 2: Versão e links */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Versão e Download</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Versão</label>
            <input value={form.version} onChange={f("version")} placeholder={APP_VERSION}
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Tamanho</label>
            <input value={form.size_mb} onChange={f("size_mb")} placeholder="28 MB"
              className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            URL do APK <span className="text-muted-foreground/60">(download direto)</span>
          </label>
          <input value={form.apk_url} onChange={f("apk_url")}
            placeholder="https://supabase.co/storage/.../itasuper-parceiro.apk"
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">
            URL Play Store <span className="text-muted-foreground/60">(se disponível, prioridade sobre APK)</span>
          </label>
          <input value={form.play_store_url} onChange={f("play_store_url")}
            placeholder="https://play.google.com/store/apps/details?id=..."
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {/* Seção 3: Descrição */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Descrição</p>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Descrição completa</label>
          <textarea value={form.description} onChange={f("description") as any}
            rows={6} placeholder="Descreva o app para os usuários..."
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          <p className="text-[10px] text-muted-foreground mt-1">Separe parágrafos com linha em branco.</p>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">O que há de novo (Novidades)</label>
          <textarea value={form.whats_new} onChange={f("whats_new") as any}
            rows={3} placeholder="Melhorias e correções desta versão..."
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
        </div>
      </div>

      {/* Seção 4: Screenshots */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          Screenshots <span className="normal-case font-normal text-muted-foreground/60">({form.screenshots.length} imagens)</span>
        </p>

        {form.screenshots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {form.screenshots.map((s, i) => (
              <div key={i} className="shrink-0 relative">
                <img src={s.url} alt={s.caption || `${i+1}`} loading="lazy" decoding="async"
                  className="w-20 h-36 object-cover rounded-xl border border-border/60" />
                <button onClick={() => removeScreenshot(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <Trash2 className="h-2.5 w-2.5 text-white" />
                </button>
                {s.caption && <p className="text-[9px] text-muted-foreground mt-1 text-center truncate w-20">{s.caption}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <input value={newScreenUrl} onChange={e => setNewScreenUrl(e.target.value)}
            placeholder="URL da imagem (https://...)"
            className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <div className="flex gap-2">
            <input value={newScreenCaption} onChange={e => setNewScreenCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              className="flex-1 bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={addScreenshot} disabled={!newScreenUrl.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Use URLs do Supabase Storage ou qualquer imagem pública. Tamanho ideal: 360×640px.</p>
        </div>
      </div>

      {/* Seção 5: Permissões */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Permissões</p>
          <button onClick={addPerm}
            className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform">
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>

        {form.permissions.map((perm, i) => (
          <div key={i} className="flex gap-2 items-start bg-muted/30 rounded-xl p-3">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <select value={perm.icon} onChange={e => updatePerm(i, "icon", e.target.value)}
                  className="bg-background border border-border/60 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                  {PERM_ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={perm.title} onChange={e => updatePerm(i, "title", e.target.value)}
                  placeholder="Nome da permissão"
                  className="flex-1 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
              </div>
              <input value={perm.desc} onChange={e => updatePerm(i, "desc", e.target.value)}
                placeholder="Por que o app precisa desta permissão?"
                className="w-full bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
            </div>
            <button onClick={() => removePerm(i)}
              className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center mt-0.5 shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      {/* Salvar (duplicado no rodapé) */}
      <button onClick={save} disabled={saving}
        className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar todas as alterações"}
      </button>
    </div>
  );
};

export default AppStorePageAdmin;
