import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, parseCurrencyToNumber } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Save, UtensilsCrossed } from "lucide-react";

interface DailyMenu {
  id: string;
  store_id: string;
  menu_date: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}

/** CRUD do "Prato do Dia" (marmitex) para lojas restaurant. Filtra por data. */
export default function RestaurantDailyMenuManager({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<{ name: string; description: string; price: string }>({
    name: "", description: "", price: "",
  });

  const { data: menus, isLoading } = useQuery({
    queryKey: ["daily-menus-admin", storeId, date],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("daily_menus")
        .select("*")
        .eq("store_id", storeId)
        .eq("menu_date", date)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as DailyMenu[]) ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["daily-menus-admin", storeId, date] });

  const create = async () => {
    const price = parseCurrencyToNumber(draft.price);
    if (!draft.name || !price) return toast.error("Informe nome e preço.");
    const { error } = await (supabase as any).from("daily_menus").insert({
      store_id: storeId, menu_date: date,
      name: draft.name.trim(), description: draft.description.trim() || null,
      price, active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Prato criado.");
    setDraft({ name: "", description: "", price: "" });
    refresh();
  };

  const toggle = async (m: DailyMenu) => {
    const { error } = await (supabase as any).from("daily_menus")
      .update({ active: !m.active }).eq("id", m.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover prato?")) return;
    const { error } = await (supabase as any).from("daily_menus").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido.");
    refresh();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
        <h3 className="text-base font-bold">Prato do Dia</h3>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="ml-auto h-9 rounded-lg border border-border bg-background px-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Novo prato
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input placeholder="Nome (ex.: Feijoada)" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          <input placeholder="Descrição (opcional)" value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          <div className="flex gap-2">
            <input placeholder="R$ 25,00" value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
            <button onClick={create}
              className="h-10 px-4 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center gap-1">
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {menus && menus.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum prato cadastrado para {new Date(date + "T00:00").toLocaleDateString("pt-BR")}.
        </p>
      )}
      <div className="space-y-2">
        {menus?.map((m) => (
          <div key={m.id} className={`flex items-center gap-3 rounded-xl border p-3 ${m.active ? "border-border bg-card" : "border-border bg-muted opacity-60"}`}>
            <div className="flex-1">
              <p className="text-sm font-bold">{m.name}</p>
              {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatBRL(Number(m.price))}</p>
            </div>
            <button onClick={() => toggle(m)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border">
              {m.active ? "Desativar" : "Ativar"}
            </button>
            <button onClick={() => remove(m.id)}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}