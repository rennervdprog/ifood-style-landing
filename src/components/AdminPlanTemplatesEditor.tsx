import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBRL, parsePercent } from "@/hooks/useBRLInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Settings2, RotateCcw } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface PlanTemplate {
  id: string;
  plan_key: string;
  plan_type: string;
  label: string;
  description: string | null;
  monthly_fee: number;
  commission_rate: number;
  features: string[] | null;
  max_slots: number | null;
  sort_order: number;
  is_active: boolean;
}

type DraftMap = Record<string, Partial<PlanTemplate> & { featuresText?: string }>;

export default function AdminPlanTemplatesEditor() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["plan-templates-editor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_templates" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as PlanTemplate[];
    },
    staleTime: 0,
  });

  // Garantir que a UI só re-inicialize drafts ao trocar a lista de IDs (evita sobrescrever edição em andamento)
  const ids = templates?.map((t) => t.id).join(",") ?? "";
  useEffect(() => {
    if (!templates) return;
    setDrafts((prev) => {
      const next: DraftMap = { ...prev };
      templates.forEach((t) => {
        if (!next[t.id]) {
          next[t.id] = {
            label: t.label,
            description: t.description ?? "",
            monthly_fee: Number(t.monthly_fee),
            commission_rate: Number(t.commission_rate),
            featuresText: Array.isArray(t.features) ? t.features.join("\n") : "",
            is_active: t.is_active,
          };
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const updateDraft = (id: string, patch: Partial<DraftMap[string]>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const resetDraft = (t: PlanTemplate) => {
    setDrafts((prev) => ({
      ...prev,
      [t.id]: {
        label: t.label,
        description: t.description ?? "",
        monthly_fee: Number(t.monthly_fee),
        commission_rate: Number(t.commission_rate),
        featuresText: Array.isArray(t.features) ? t.features.join("\n") : "",
        is_active: t.is_active,
      },
    }));
  };

  const saveTemplate = async (t: PlanTemplate) => {
    const draft = drafts[t.id];
    if (!draft) return;

    const monthlyFee = Number(draft.monthly_fee);
    const commissionRate = Number(draft.commission_rate);

    if (Number.isNaN(monthlyFee) || monthlyFee < 0) {
      toast.error("Mensalidade inválida");
      return;
    }
    if (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      toast.error("Comissão deve estar entre 0 e 100");
      return;
    }
    if (!String(draft.label || "").trim()) {
      toast.error("Nome do plano é obrigatório");
      return;
    }

    const features = (draft.featuresText || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(t.id);
    try {
      const { error } = await supabase
        .from("plan_templates" as any)
        .update({
          label: draft.label,
          description: draft.description || null,
          monthly_fee: monthlyFee,
          commission_rate: commissionRate,
          features,
          is_active: !!draft.is_active,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", t.id);

      if (error) throw error;

      toast.success(`Plano "${draft.label}" atualizado`);
      await queryClient.invalidateQueries({ queryKey: ["plan-templates-editor"] });
      await queryClient.invalidateQueries({ queryKey: ["plan-templates"] });
    } catch (err: any) {
      console.error("[AdminPlanTemplatesEditor] save error", err);
      toast.error(err?.message || "Erro ao salvar plano");
    } finally {
      setSaving(null);
    }
  };

  const isDirty = (t: PlanTemplate) => {
    const d = drafts[t.id];
    if (!d) return false;
    const originalFeatures = Array.isArray(t.features) ? t.features.join("\n") : "";
    return (
      d.label !== t.label ||
      (d.description ?? "") !== (t.description ?? "") ||
      Number(d.monthly_fee) !== Number(t.monthly_fee) ||
      Number(d.commission_rate) !== Number(t.commission_rate) ||
      (d.featuresText ?? "") !== originalFeatures ||
      d.is_active !== t.is_active
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-bold">Editar Templates de Planos</h3>
          <p className="text-xs text-muted-foreground">
            Altere preços, comissões e descrições. As mudanças aparecem imediatamente no painel de planos das lojas.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {(templates || []).map((t) => {
          const d = drafts[t.id] || {};
          const dirty = isDirty(t);
          return (
            <div key={t.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {t.plan_key}
                  </span>
                  <span className="text-xs text-muted-foreground">tipo: {t.plan_type}</span>
                  {!d.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive">inativo</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${t.id}`} className="text-xs">Ativo</Label>
                  <Switch
                    id={`active-${t.id}`}
                    checked={!!d.is_active}
                    onCheckedChange={(v) => updateDraft(t.id, { is_active: v })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={d.label ?? ""}
                    onChange={(e) => updateDraft(t.id, { label: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Mensalidade (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={d.monthly_fee ?? 0}
                      onChange={(e) => updateDraft(t.id, { monthly_fee: parsePercent(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Atual: {formatBRL(Number(t.monthly_fee))}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Comissão (%)</Label>
                    <Input
                      type="text" inputMode="decimal"
                      value={d.commission_rate ?? 0}
                      onChange={(e) => updateDraft(t.id, { commission_rate: parsePercent(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Atual: {Number(t.commission_rate)}%</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição curta</Label>
                <Input
                  value={d.description ?? ""}
                  onChange={(e) => updateDraft(t.id, { description: e.target.value })}
                  placeholder="Ex.: Mensalidade fixa, sem comissão..."
                />
              </div>

              <div>
                <Label className="text-xs">Funcionalidades (uma por linha)</Label>
                <Textarea
                  rows={4}
                  value={d.featuresText ?? ""}
                  onChange={(e) => updateDraft(t.id, { featuresText: e.target.value })}
                  placeholder={"Cardápio digital\nPedidos online\n..."}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetDraft(t)}
                  disabled={!dirty || saving === t.id}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reverter
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveTemplate(t)}
                  disabled={!dirty || saving === t.id}
                >
                  {saving === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}