import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShoppingBag,
  Store,
  Bike,
  Heart,
  UserPlus,
  Smartphone,
  Instagram,
  MessageCircle,
  FileText,
  Shield,
  Link as LinkIcon,
  Pencil,
  Trash2,
  Plus,
  ExternalLink,
  Star,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";

/* ----------- Allowed icons (whitelist for safety) ----------- */
const ICON_MAP = {
  ShoppingBag,
  Store,
  Bike,
  Heart,
  UserPlus,
  Smartphone,
  Instagram,
  MessageCircle,
  FileText,
  Shield,
  Link: LinkIcon,
} as const;

type IconKey = keyof typeof ICON_MAP;
const ICON_KEYS = Object.keys(ICON_MAP) as IconKey[];

/* ----------- Zod schema ----------- */
const linkSchema = z.object({
  label: z.string().trim().min(1, "Texto obrigatório").max(60, "Máx 60 caracteres"),
  description: z.string().trim().max(120, "Máx 120 caracteres").optional().or(z.literal("")),
  url: z
    .string()
    .trim()
    .min(1, "URL obrigatória")
    .max(500, "URL muito longa")
    .refine(
      (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
      "Use uma URL iniciando com / (interna) ou https://",
    ),
  icon: z.enum(ICON_KEYS as [IconKey, ...IconKey[]]),
  is_external: z.boolean(),
  is_highlight: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

type LinkInput = z.infer<typeof linkSchema>;

interface AppLink extends LinkInput {
  id: string;
}

const emptyForm: LinkInput = {
  label: "",
  description: "",
  url: "",
  icon: "Link",
  is_external: false,
  is_highlight: false,
  is_active: true,
  sort_order: 100,
};

export default function AppLinksManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LinkInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: links, isLoading } = useQuery({
    queryKey: ["app-links-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_links")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as AppLink[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["app-links-admin"] });
    qc.invalidateQueries({ queryKey: ["app-links-public"] });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: (links?.length ?? 0) * 10 + 10 });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (link: AppLink) => {
    setEditingId(link.id);
    setForm({
      label: link.label,
      description: link.description ?? "",
      url: link.url,
      icon: (ICON_KEYS as string[]).includes(link.icon) ? (link.icon as IconKey) : "Link",
      is_external: link.is_external,
      is_highlight: link.is_highlight,
      is_active: link.is_active,
      sort_order: link.sort_order,
    });
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const parsed = linkSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path.join(".")] = i.message;
      });
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        description: parsed.data.description || null,
      };
      if (editingId) {
        const { error } = await supabase.from("app_links").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Link atualizado");
      } else {
        const { error } = await supabase.from("app_links").insert(payload);
        if (error) throw error;
        toast.success("Link criado");
      }
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (link: AppLink) => {
    const { error } = await supabase
      .from("app_links")
      .update({ is_active: !link.is_active })
      .eq("id", link.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const move = async (link: AppLink, dir: -1 | 1) => {
    if (!links) return;
    const idx = links.findIndex((l) => l.id === link.id);
    const swap = links[idx + dir];
    if (!swap) return;
    const a = supabase.from("app_links").update({ sort_order: swap.sort_order }).eq("id", link.id);
    const b = supabase.from("app_links").update({ sort_order: link.sort_order }).eq("id", swap.id);
    const [r1, r2] = await Promise.all([a, b]);
    if (r1.error || r2.error) return toast.error("Erro ao reordenar");
    refresh();
  };

  const remove = async (link: AppLink) => {
    if (!confirm(`Remover "${link.label}"?`)) return;
    const { error } = await supabase.from("app_links").delete().eq("id", link.id);
    if (error) return toast.error(error.message);
    toast.success("Link removido");
    refresh();
  };

  const copyPublicUrl = async () => {
    const url = `${window.location.origin}/links`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado: " + url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4">
        <div>
          <h3 className="font-bold text-foreground">Página de Links Públicos</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os botões exibidos em <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/links</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyPublicUrl}>
            <Copy className="w-4 h-4 mr-1.5" /> Copiar URL
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo link
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : !links?.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm bg-card border rounded-xl">
          Nenhum link cadastrado
        </div>
      ) : (
        <div className="grid gap-2">
          {links.map((link, i) => {
            const Icon = ICON_MAP[(link.icon as IconKey) in ICON_MAP ? (link.icon as IconKey) : "Link"];
            return (
              <div
                key={link.id}
                className={`flex items-center gap-3 bg-card border rounded-xl p-3 ${
                  !link.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="shrink-0 w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{link.label}</span>
                    {link.is_highlight && (
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    )}
                    {link.is_external && (
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{link.url}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={i === 0}
                    onClick={() => move(link, -1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={i === links.length - 1}
                    onClick={() => move(link, 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleActive(link)}
                    title={link.is_active ? "Desativar" : "Ativar"}
                  >
                    {link.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(link)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(link)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar link" : "Novo link"}</DialogTitle>
            <DialogDescription>
              Configure como o botão será exibido na página pública.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Texto do botão *</Label>
              <Input
                value={form.label}
                maxLength={60}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              {errors.label && <p className="text-xs text-destructive mt-1">{errors.label}</p>}
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                maxLength={120}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {errors.description && (
                <p className="text-xs text-destructive mt-1">{errors.description}</p>
              )}
            </div>

            <div>
              <Label>URL *</Label>
              <Input
                placeholder="/cadastro-lojista ou https://..."
                value={form.url}
                maxLength={500}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              {errors.url && <p className="text-xs text-destructive mt-1">{errors.url}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ícone</Label>
                <Select
                  value={form.icon}
                  onValueChange={(v) => setForm({ ...form, icon: v as IconKey })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_KEYS.map((k) => {
                      const Ico = ICON_MAP[k];
                      return (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <Ico className="w-4 h-4" /> {k}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Link externo (abre nova aba)</Label>
                <Switch
                  checked={form.is_external}
                  onCheckedChange={(v) => setForm({ ...form, is_external: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Destaque (laranja)</Label>
                <Switch
                  checked={form.is_highlight}
                  onCheckedChange={(v) => setForm({ ...form, is_highlight: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Ativo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
