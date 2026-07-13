import StoreSettings from "@/components/StoreSettings";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import { MessageCircle, Monitor, Copy, Loader2, RefreshCw, Ban, Store as StoreIcon } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStorePlan } from "@/hooks/useStorePlan";

interface Props {
  store: any;
}

type SubTab = "loja" | "whatsapp" | "kds";

const SettingsTab = ({ store }: Props) => {
  const storePlan = useStorePlan(store?.id);
  const isPdvOnly = storePlan.planType === "pdv_only";
  const [subTab, setSubTab] = useState<SubTab>("loja");
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

  const generateKdsLink = () => callKds("generate-token");
  const revokeKdsLink = () => callKds("revoke-token");

  const kdsUrl = kdsToken ? `${window.location.origin}/kds/${kdsToken}` : "";

  return (
  <div className="space-y-6">
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
      {([
        { key: "loja" as SubTab, label: isPdvOnly ? "Loja" : "Loja & Entrega", icon: StoreIcon },
        ...(isPdvOnly ? [] : [{ key: "whatsapp" as SubTab, label: "WhatsApp", icon: MessageCircle }]),
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

    {subTab === "whatsapp" && !isPdvOnly && (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">WhatsApp</h2>
      </div>
      <WhatsAppSetup
        storeId={store.id}
        storeSlug={store.slug || ""}
        storeName={store.name}
        expectedPhone={store.whatsapp_number || store.whatsapp || store.phone || null}
      />
    </section>
    )}

    {subTab === "kds" && (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
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
      <p className="text-[11px] text-muted-foreground">
        "Gerar novo link" mantém o atual válido. "Desativar link atual" invalida imediatamente o link anterior e cria um novo — use se o link vazar.
      </p>
    </section>
    )}

    {subTab === "loja" && (
    <StoreSettings 
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

export default SettingsTab;
