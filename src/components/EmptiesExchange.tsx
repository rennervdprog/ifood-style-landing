import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils";
import { Recycle } from "lucide-react";
import type { CartItem } from "@/contexts/CartContext";

export interface EmptiesExchangeSelection {
  group: string;
  qty: number;
  unit_price: number;
  returnable_group_id: string;
}

interface Props {
  storeId: string;
  items: CartItem[];
  onChange: (selections: EmptiesExchangeSelection[], totalDiscount: number) => void;
}

/**
 * Mostra um toggle para o cliente trocar casquinhas que já tem em saldo.
 * Só aparece para itens com metadata.returnable_bottle + deposit_price + returnable_group.
 */
const EmptiesExchange = ({ storeId, items, onChange }: Props) => {
  const { user } = useAuth();

  // Agrupa itens do carrinho por returnable_group
  const groupsInCart = useMemo(() => {
    const map = new Map<string, { qty: number; unit_price: number }>();
    for (const it of items) {
      const md: any = it.metadata || {};
      if (!md.returnable_bottle) continue;
      const group = String(md.returnable_group || "").trim().toLowerCase();
      const price = parseFloat(String(md.deposit_price || "0").replace(",", ".")) || 0;
      if (!group || price <= 0) continue;
      const cur = map.get(group) || { qty: 0, unit_price: price };
      cur.qty += it.quantity;
      cur.unit_price = price;
      map.set(group, cur);
    }
    return Array.from(map.entries()).map(([group, v]) => ({ group, ...v }));
  }, [items]);

  // Busca saldo do cliente para esses grupos nessa loja
  const groupNames = groupsInCart.map(g => g.group);
  const { data: saldos } = useQuery({
    queryKey: ["empties-saldo", storeId, user?.id, groupNames.join("|")],
    queryFn: async () => {
      if (!user?.id || groupNames.length === 0) return [] as any[];
      const { data: groups } = await (supabase as any)
        .from("returnable_groups")
        .select("id, name")
        .eq("store_id", storeId)
        .in("name", groupNames);
      if (!groups || groups.length === 0) return [];
      const ids = groups.map((g: any) => g.id);
      const { data: empties } = await (supabase as any)
        .from("customer_empties")
        .select("returnable_group_id, qty")
        .eq("customer_id", user.id)
        .eq("store_id", storeId)
        .in("returnable_group_id", ids);
      return groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        saldo: empties?.find((e: any) => e.returnable_group_id === g.id)?.qty || 0,
      }));
    },
    enabled: !!user?.id && groupNames.length > 0 && !!storeId,
    staleTime: 30_000,
  });

  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  // Linhas disponíveis (saldo > 0)
  const availableLines = useMemo(() => {
    if (!saldos) return [];
    return groupsInCart
      .map(g => {
        const s = saldos.find((x: any) => x.name === g.group);
        if (!s || s.saldo <= 0) return null;
        const exchangeable = Math.min(g.qty, s.saldo);
        return { ...g, returnable_group_id: s.id, saldo: s.saldo, exchangeable };
      })
      .filter(Boolean) as Array<{
        group: string; qty: number; unit_price: number;
        returnable_group_id: string; saldo: number; exchangeable: number;
      }>;
  }, [groupsInCart, saldos]);

  // Notifica parent sobre seleção + desconto
  useEffect(() => {
    const selections: EmptiesExchangeSelection[] = availableLines
      .filter(l => enabled[l.group])
      .map(l => ({
        group: l.group,
        qty: l.exchangeable,
        unit_price: l.unit_price,
        returnable_group_id: l.returnable_group_id,
      }));
    const discount = selections.reduce((s, x) => s + x.qty * x.unit_price, 0);
    onChange(selections, discount);
  }, [availableLines, enabled, onChange]);

  if (availableLines.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <Recycle className="h-4 w-4" />
        <span className="text-xs font-bold">Trocar casquinhas que você já tem</span>
      </div>
      {availableLines.map(l => (
        <label key={l.group} className="flex items-center justify-between gap-3 text-sm cursor-pointer">
          <div className="flex-1">
            <p className="font-semibold text-foreground">{l.group}</p>
            <p className="text-[11px] text-muted-foreground">
              Trocar {l.exchangeable} de {l.qty} • saldo {l.saldo} • {formatBRL(l.unit_price)} por casco
            </p>
          </div>
          <input
            type="checkbox"
            checked={!!enabled[l.group]}
            onChange={e => setEnabled(p => ({ ...p, [l.group]: e.target.checked }))}
            className="h-5 w-5 accent-emerald-600"
          />
        </label>
      ))}
    </div>
  );
};

export default EmptiesExchange;