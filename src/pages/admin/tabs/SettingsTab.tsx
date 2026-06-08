import StoreSettings from "@/components/StoreSettings";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import { MessageCircle, Monitor, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  store: any;
}

const SettingsTab = ({ store }: Props) => {
  const [kdsToken, setKdsToken] = useState<string>("");
  const [kdsLoading, setKdsLoading] = useState(false);

  const generateKdsLink = async () => {
    setKdsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("kds", {
        body: { action: "generate-token", store_id: store.id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erro");
      }
      const token = (data as any).token as string;
      setKdsToken(token);
      const url = `${window.location.origin}/kds/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link KDS gerado e copiado!");
      } catch {
        toast.success("Link KDS gerado!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar link KDS");
    } finally {
      setKdsLoading(false);
    }
  };

  const kdsUrl = kdsToken ? `${window.location.origin}/kds/${kdsToken}` : "";

  return (
  <div className="space-y-6">
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
      <button
        onClick={generateKdsLink}
        disabled={kdsLoading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
      >
        {kdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : kdsToken ? <RefreshCw className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        {kdsToken ? "Gerar novo link" : "Gerar link do KDS"}
      </button>
      {kdsToken && (
        <p className="text-[11px] text-muted-foreground">
          Ao gerar um novo link, este atual continua válido (o token usa assinatura permanente). Se precisar revogar, peça suporte.
        </p>
      )}
    </section>
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
      storeSettings={store.settings || null} 
    />
  </div>
  );
};

export default SettingsTab;
