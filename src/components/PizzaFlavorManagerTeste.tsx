/**
 * CÓPIA DE TESTE (/admin-teste) de src/components/PizzaFlavorManager.tsx.
 * Mesma tela, com a seção "Múltiplos sabores + cálculo de preço" redesenhada
 * para ser fácil de entender (estudo 25/10/2026). NÃO usada pelo /admin original.
 *
 * O que mudou (só apresentação; nenhuma lógica de preço muda):
 * - Um único interruptor "Múltiplos sabores" (antes eram dois para o mesmo
 *   campo) junto com a escolha do modo, sempre visível — as opções não
 *   somem mais quando o interruptor está desligado.
 * - "Média" e "Soma dividida" viraram uma só opção, "Somar os sabores":
 *   no código elas são a MESMA regra em todos os fluxos
 *   (combinePricesByMode trata as duas como média; o modal da vitrine
 *   trata as duas como soma). Nenhuma loja tinha "media" ou "soma"
 *   guardado (0 de 37 em 25/10/2026), então nada muda para nenhuma loja.
 * - Cada modo mostra descrição simples + exemplo com números reais e diz
 *   onde vale; o modo atual da loja aparece com o efeito dele; e fica
 *   claro que a regra só vale para os sabores (adicionais normais sempre
 *   somam). O modo "padrão" (nenhum valor guardado) é mostrado como
 *   "Somar os sabores (padrão)", e não como "Maior valor" — antes a tela
 *   marcava "Maior valor" como ativo por padrão, mas a vitrine somava.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pizza } from "lucide-react";
import PizzaSizesCatalogManager from "@/components/pizza/PizzaSizesCatalogManager";

interface PizzaFlavorManagerProps {
  storeId: string;
}

interface PizzaConfig {
  sizes?: string[];
  flavors?: any[];
  max_flavors?: 2 | 3 | 4;
}

type PizzaPriceMode = "maior" | "media" | "soma";

const PizzaFlavorManagerTeste = ({ storeId }: PizzaFlavorManagerProps) => {
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-for-pizza", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });

  const settings = (store?.settings || {}) as Record<string, any>;
  const pizzaConfig: PizzaConfig = settings.pizza_config || {};
  const maxFlavors: 2 | 3 | 4 = (pizzaConfig.max_flavors as 2 | 3 | 4) || 4;
  const halfEnabled: boolean = settings.pizza_half_enabled !== false;
  // Modo guardado de verdade (sem padrão inventado): quando a loja nunca
  // escolheu, o campo vem ausente — e a vitrine soma os sabores. Antes a
  // tela mostrava "Maior valor" como ativo nesse caso, mas a vitrine somava.
  const storedMode = settings.pizza_price_mode as PizzaPriceMode | undefined;
  const hasChosenMode = !!storedMode;
  const isHighest = storedMode === "maior";
  // "media" e "soma" são a mesma regra em todos os fluxos (ver o comentário
  // no topo do arquivo): a tela trata os dois valores legados como uma
  // única opção, "Somar os sabores". Clicar nela grava "soma".
  const isSum = !isHighest;
  const singleSize: boolean = !!settings.pizza_single_size;

  const saveConfig = async (newConfig: PizzaConfig) => {
    const newSettings = { ...settings, pizza_config: newConfig } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pizza", storeId] });
  };

  const saveSettingField = async (patch: Record<string, any>) => {
    const newSettings = { ...settings, ...patch } as any;
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    queryClient.invalidateQueries({ queryKey: ["store-for-pizza", storeId] });
  };

  const setMaxFlavors = async (n: 2 | 3 | 4) => {
    await saveConfig({ ...pizzaConfig, max_flavors: n });
    toast.success(n === 2 ? "Apenas meio a meio" : `Até ${n} sabores por pizza`);
  };

  return (
    <div className="space-y-6">
      {/* Múltiplos sabores + cálculo de preço — tudo junto e sempre visível */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Pizza className="h-4 w-4 text-primary" /> Múltiplos sabores
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Quando ativo, o cliente monta a pizza com 2, 3 ou 4 sabores. Quando desligado, cada pizza é vendida como produto único.
            </p>
          </div>
          <button
            onClick={() => saveSettingField({ pizza_half_enabled: !halfEnabled })}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${halfEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
            aria-label="Permitir múltiplos sabores"
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${halfEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Modo atual da loja, com o efeito dele */}
        <p className="text-xs text-foreground/80 bg-muted/40 rounded-xl px-3 py-2 leading-relaxed">
          {halfEnabled ? "Modo atual: " : "Modo guardado: "}
          <b>{isHighest ? "Maior valor" : "Somar os sabores"}</b>
          {!hasChosenMode && " (padrão — você ainda não escolheu um modo)"}
          {isHighest
            ? " — a pizza custa o preço do sabor mais caro."
            : " — os sabores somam na vitrine."}
          {!halfEnabled && " Só vale quando múltiplos sabores estão ativos."}
        </p>

        {/* Escolha do modo — sempre visível, nunca escondida */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-foreground/70">Como o preço é calculado com vários sabores?</p>
          {([
            {
              id: "maior" as const,
              title: "Maior valor",
              desc: "A pizza custa o preço do sabor mais caro.",
              example: "Exemplo: 2 sabores de R$ 79,99 e R$ 99,99 → a pizza custa R$ 99,99.",
              note: "Vale na vitrine, no “Monte sua pizza” e no checkout.",
            },
            {
              id: "soma" as const,
              title: "Somar os sabores",
              desc: "Os sabores somam. É o padrão para lojas novas.",
              example: "Exemplo: 2 sabores de R$ 79,99 e R$ 99,99 → a pizza custa R$ 179,98.",
              note: "No “Monte sua pizza”, o preço usado é a média dos sabores (R$ 89,99 no exemplo).",
            },
          ]).map(opt => {
            const active = opt.id === "maior" ? isHighest : isSum;
            return (
              <button
                key={opt.id}
                onClick={() => saveSettingField({ pizza_price_mode: opt.id })}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <p className={`text-sm font-bold flex items-center gap-2 ${active ? "text-primary" : "text-foreground"}`}>
                  {opt.title}
                  {opt.id === "soma" && !hasChosenMode && (
                    <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">Padrão</span>
                  )}
                </p>
                <p className="text-[11px] text-foreground/80 mt-0.5">{opt.desc}</p>
                <p className="text-[11px] font-bold text-foreground mt-1">{opt.example}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{opt.note}</p>
              </button>
            );
          })}
          <p className="text-[10px] text-muted-foreground">
            Essa regra só vale para os sabores. Adicionais normais — borda e extras — sempre somam, em qualquer modo.
          </p>
        </div>
      </div>

      {/* Catálogo profissional (tamanhos + categorias + matriz) */}
      <PizzaSizesCatalogManager storeId={storeId} />

      {/* Explanation banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1.5">
        <p className="text-xs font-bold text-primary uppercase tracking-wider">Como funciona?</p>
        <p className="text-xs text-foreground/80 leading-relaxed">
          1️⃣ Cadastre cada <b>sabor de pizza como um produto normal</b> na aba <b>Cardápio</b> (com nome, foto e preço).<br/>
          2️⃣ Aqui você define apenas a <b>regra de combinação</b>: quantos sabores cabem em uma pizza e como o preço é calculado quando o cliente escolher mais de um.<br/>
          3️⃣ Para evitar que <b>bebidas</b> apareçam no modal de meio a meio, marque a opção <b>"É bebida?"</b> ao criar o produto.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Pizza className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Regras de Combinação</h2>
      </div>

      {/* Single vs multi size */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Trabalha com um único tamanho?</p>
            <p className="text-[10px] text-muted-foreground">
              Ative se sua pizzaria vende pizza em um tamanho só. O editor de tamanhos some do cadastro de produtos e o cliente vê apenas o preço base — meio a meio e múltiplos sabores continuam funcionando normalmente.
            </p>
          </div>
          <button
            onClick={() => saveSettingField({ pizza_single_size: !singleSize })}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${singleSize ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${singleSize ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Max flavors per pizza */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-foreground/70 uppercase">Sabores por pizza</h3>
        <div className="grid grid-cols-3 gap-2">
          {([2, 3, 4] as const).map(n => {
            const active = maxFlavors === n;
            return (
              <button
                key={n}
                onClick={() => setMaxFlavors(n)}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                  active
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-muted border-transparent text-muted-foreground"
                }`}
              >
                <span className="text-xl font-black">{n}</span>
                <span className="text-[10px] font-bold mt-0.5">
                  {n === 2 ? "Só meio a meio" : `Até ${n} sabores`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Define o máximo de sabores que o cliente pode combinar em uma única pizza.
        </p>
      </div>

    </div>
  );
};

export default PizzaFlavorManagerTeste;
