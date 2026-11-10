import StoreSettingsReorg, { type StoreSettingsSectionKey } from "../components/teste/StoreSettingsReorg";
import { readUrlParam, writeUrlParam } from "../urlParams";
import TabHeader from "@/components/TabHeader";
import TutorialHelpButton from "@/components/TutorialHelp";
import WhatsAppSetupTeste from "../components/teste/WhatsAppSetupTeste";
import WhatsAppConversationsTeste, { CONVERSATION_OPEN_EVENT } from "../components/teste/WhatsAppConversationsTeste";
import { MessageCircle, MessagesSquare, Monitor, Copy, Loader2, RefreshCw, Ban, Store as StoreIcon, MapPin, Truck, CreditCard, Bell, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStorePlan } from "@/hooks/useStorePlan";
import {
  SETTINGS_GOTO_EVENT,
  SETTINGS_SECTIONS,
  consumePendingSettingsSection,
  scrollToElementById,
  type SettingsSection,
} from "../settingsSections";

interface Props {
  store: any;
}

type SubTab = StoreSettingsSectionKey | "whatsapp" | "conversas" | "kds";

/** Lição do "Como funciona" de cada sub-aba de Configurações (Fase 3). */
const SETTINGS_SUBTAB_HELP: Partial<Record<SubTab, string>> = {
  notificacoes: "notifications",
  impressao: "printing",
  whatsapp: "whatsapp",
  conversas: "conversations",
  kds: "kds",
};

/**
 * REORG FASE 5 — cópia de SettingsTabTeste.
 * Idêntica à cópia Teste, EXCETO:
 *  a. FASE 5: as 6 seções internas de "Loja & Entrega" (Loja, Endereço,
 *     Entrega e Taxas, Pagamentos, Notificações, Impressão) viraram
 *     pílulas de primeiro nível, no mesmo nível de WhatsApp/Conversas/
 *     KDS. Cada uma renderiza só a sua seção do StoreSettingsReorg.
 *     O atalho da busca (evento SETTINGS_GOTO_EVENT) continua funcionando
 *     por baixo, mas não renderiza segunda navegação na tela.
 *  b. Componentes: StoreSettingsReorg (salvar por seção, Salvar fixo),
 *     WhatsAppSetupTeste (dois WhatsApps explicados, salvar por seção) e
 *     WhatsAppConversationsTeste (resposta dentro do painel, prévia de
 *     mídia). KDS é o mesmo fluxo de antes (gerar/revogar link).
 *  c. ABRIR CONVERSA DE FORA: escuta o evento de abrir conversa
 *     (telefone) e abre a sub-aba Conversas já na conversa certa.
 *  d. Sem bot guiado e sem Asaas (a base já não os tem — nada reintroduzido).
 */
const SettingsTabReorg = ({ store }: Props) => {
  const storePlan = useStorePlan(store?.id);
  const isPdvOnly = storePlan.planType === "pdv_only";
  const [subTab, setSubTab] = useState<SubTab>(() => {
    // URL por tela: abre direto na secao pedida (?secao=entrega etc.).
    const fromUrl = readUrlParam("secao");
    const valid: SubTab[] = ["loja", "endereco", "entrega", "pagamentos", "notificacoes", "impressao", "whatsapp", "conversas", "kds"];
    return fromUrl && valid.includes(fromUrl as SubTab) ? (fromUrl as SubTab) : "loja";
  });
  // Espelha a sub-aba atual em ?secao= (recarregar volta pra mesma secao).
  useEffect(() => {
    writeUrlParam("secao", subTab === "loja" ? null : subTab);
  }, [subTab]);
  // Loja PDV Only nao tem WhatsApp/Conversas: se a URL pediu uma delas,
  // volta pra Loja em vez de mostrar tela vazia.
  useEffect(() => {
    if (isPdvOnly && (subTab === "whatsapp" || subTab === "conversas")) setSubTab("loja");
  }, [isPdvOnly, subTab]);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [kdsToken, setKdsToken] = useState<string>("");
  const [kdsLoading, setKdsLoading] = useState(false);
  const [kdsRevoking, setKdsRevoking] = useState(false);

  const callKds = async (action: "generate-token" | "revoke-token") => {
    if (action === "revoke-token") setKdsRevoking(true); else setKdsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kds", {
        body: { action, store_id: store.id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erro");
      }
      const token = (data as any).token as string;
      setKdsToken(token);
      const url = `${window.location.origin}/kds/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(action === "revoke-token" ? "Link anterior desativado. Novo link copiado!" : "Link KDS gerado e copiado!");
      } catch {
        toast.success(action === "revoke-token" ? "Link anterior desativado!" : "Link KDS gerado!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha na operação");
    } finally {
      setKdsLoading(false);
      setKdsRevoking(false);
    }
  };

  // ── Âncoras "Nesta página" (Fase 4): troca a sub-aba e rola até a seção ──
  // REORG FASE 5: as seções de "Loja & Entrega" viraram sub-abas próprias.
  const SUBTAB_BY_SECTION_ID: Record<string, SubTab> = {
    "config-loja": "loja",
    "config-endereco": "endereco",
    "config-entrega": "entrega",
    "config-pagamentos": "pagamentos",
    "config-whatsapp": "whatsapp",
    "config-conversas": "conversas",
    "config-kds": "kds",
  };
  const gotoSection = useCallback(
    (section: SettingsSection) => {
      if (section.hideOnPdvOnly && isPdvOnly) return;
      setSubTab(SUBTAB_BY_SECTION_ID[section.id] ?? section.subTab);
      scrollToElementById(section.id);
    },
    [isPdvOnly],
  );

  useEffect(() => {
    const pending = consumePendingSettingsSection();
    if (pending) {
      const s = SETTINGS_SECTIONS.find((x) => x.id === pending);
      if (s) gotoSection(s);
    }
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const s = SETTINGS_SECTIONS.find((x) => x.id === id);
      if (s) gotoSection(s);
    };
    window.addEventListener(SETTINGS_GOTO_EVENT, handler);
    const openHandler = (e: Event) => {
      const phone = (e as CustomEvent<string>).detail;
      if (phone) { setOpenPhone(phone); setSubTab("conversas"); }
    };
    window.addEventListener(CONVERSATION_OPEN_EVENT, openHandler);
    return () => {
      window.removeEventListener(SETTINGS_GOTO_EVENT, handler);
      window.removeEventListener(CONVERSATION_OPEN_EVENT, openHandler);
    };
  }, [gotoSection]);


  const generateKdsLink = () => callKds("generate-token");
  const revokeKdsLink = () => callKds("revoke-token");

  const kdsUrl = kdsToken ? `${window.location.origin}/kds/${kdsToken}` : "";

  const STORE_SECTIONS: StoreSettingsSectionKey[] = ["loja", "endereco", "entrega", "pagamentos", "notificacoes", "impressao"];
  const isStoreSection = STORE_SECTIONS.includes(subTab as StoreSettingsSectionKey);

  return (
  <div className="space-y-6">
    <TabHeader title="Configurações da loja" subtitle="Loja, entrega, pagamentos e WhatsApp" tutorialId="settings" />
    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
      {([
        { key: "loja" as SubTab, label: "Loja", icon: StoreIcon },
        { key: "endereco" as SubTab, label: "Endereço", icon: MapPin },
        { key: "entrega" as SubTab, label: "Entrega e Taxas", icon: Truck },
        { key: "pagamentos" as SubTab, label: "Pagamentos", icon: CreditCard },
        { key: "notificacoes" as SubTab, label: "Notificações", icon: Bell },
        { key: "impressao" as SubTab, label: "Impressão", icon: Printer },
        ...(isPdvOnly ? [] : [{ key: "whatsapp" as SubTab, label: "WhatsApp", icon: MessageCircle }, { key: "conversas" as SubTab, label: "Conversas", icon: MessagesSquare }]),
        { key: "kds" as SubTab, label: "KDS", icon: Monitor },
      ]).map(t => (
        <button
          key={t.key}
          onClick={() => setSubTab(t.key)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            subTab === t.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border"
          }`}
        >
          <t.icon className="h-3.5 w-3.5" /> {t.label}
        </button>
      ))}
    </div>

    {/* Ajuda da sub-aba atual (Fase 3 dos tutoriais, 2026-11-10) */}
    {SETTINGS_SUBTAB_HELP[subTab] && (
      <div className="flex justify-end px-1 -mt-3">
        <TutorialHelpButton tutorialId={SETTINGS_SUBTAB_HELP[subTab]!} />
      </div>
    )}

    {subTab === "whatsapp" && !isPdvOnly && (
    <section id="config-whatsapp" className="rounded-2xl border border-border bg-card p-4 space-y-3 scroll-mt-24">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">WhatsApp</h2>
      </div>
      <WhatsAppSetupTeste
        storeId={store.id}
        storeSlug={store.slug || ""}
        storeName={store.name}
        expectedPhone={store.whatsapp_number || store.whatsapp || store.phone || null}
      />
    </section>
    )}

    {subTab === "conversas" && !isPdvOnly && (
    <section id="config-conversas" className="rounded-2xl border border-border bg-card p-4 space-y-3 scroll-mt-24">
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Conversas do WhatsApp</h2>
      </div>
      <WhatsAppConversationsTeste storeId={store.id} initialPhone={openPhone} />
    </section>
    )}

    {subTab === "kds" && (
    <section id="config-kds" className="rounded-2xl border border-border bg-card p-4 space-y-3 scroll-mt-24">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Display de Cozinha (KDS)</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Abra este link em um tablet ou TV na cozinha para ver e gerenciar os pedidos em tempo real. Não exige login — não desconecta o app principal.
      </p>
      {kdsUrl && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={kdsUrl}
            className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 font-mono truncate"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(kdsUrl); toast.success("Copiado!"); } catch {}
            }}
            className="p-2 rounded-lg bg-primary text-primary-foreground"
            title="Copiar"
          >
            <Copy className="h-4 w-4" />
          </button>
          <a
            href={kdsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold px-3 py-2 rounded-lg bg-muted hover:bg-accent"
          >
            Abrir
          </a>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={generateKdsLink}
          disabled={kdsLoading || kdsRevoking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
        >
          {kdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : kdsToken ? <RefreshCw className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          {kdsToken ? "Gerar novo link" : "Gerar link do KDS"}
        </button>
        <button
          onClick={revokeKdsLink}
          disabled={kdsLoading || kdsRevoking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50"
          title="Desativa o link atual e gera um novo. O link antigo deixa de funcionar imediatamente."
        >
          {kdsRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          Desativar link atual
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        "Gerar novo link" mantém o atual válido. "Desativar link atual" invalida imediatamente o link anterior e cria um novo — use se o link vazar.
      </p>
    </section>
    )}

    {isStoreSection && (
    <StoreSettingsReorg key={subTab} onlySection={subTab as StoreSettingsSectionKey} 
      storeId={store.id} 
      storeName={store.name} 
      storeCategory={store.category}
      storeCategories={store.categories || null}
      storeImageUrl={store.image_url} 
      storeIsOpen={store.is_open}
      forceClosed={store.force_closed || false} 
      storeSlug={store.slug || null}
      storeAddressStreet={store.address_street || null}
      storeAddressNumber={store.address_number || null}
      storeAddressComplement={store.address_complement || null}
      storeAddressNeighborhood={store.address_neighborhood || null}
      storeAddressReference={store.address_reference || null}
      storeAddressCity={store.address_city || null}
      storeAddressState={store.address_state || null}
      storeAddressCep={store.address_cep || null}
      storeDeliveryMode={store.delivery_mode || "platform"}
      storeOwnDeliveryFee={store.own_delivery_fee || 0}
      storeDeliveryFeeType={store.delivery_fee_type || "fixed"}
      storeDeliveryBaseKm={store.delivery_base_km || 0}
      storeDeliveryFeeBase={store.delivery_fee_base || 0}
      storeDeliveryFeePerKm={store.delivery_fee_per_km || 0}
      storeMinimumOrderValue={store.minimum_order_value || 0}
      storeEstimatedDeliveryTime={store.estimated_delivery_time || null}
      storeSettings={store.settings || null} 
    />
    )}
  </div>
  );
};

export default SettingsTabReorg;
