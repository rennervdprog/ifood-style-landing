/**
 * CÓPIA DE TESTE (/admin-teste) de src/pages/admin/tabs/SubscriptionTab.tsx.
 * Idêntica ao original, EXCETO: renderiza StoreSubscriptionTeste em
 * vez do StoreSubscription original — para o Meu Plano do /admin-teste
 * não exibir mais a taxa por pedido PIX (regra vigente: Pix direto,
 * sem taxa do ItaSuper).
 */
import StoreSubscriptionTeste from "@/components/StoreSubscriptionTeste";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
  storeName: string;
}

const SubscriptionTabTeste = ({ storeId, storeName }: Props) => (
  <div className="max-w-2xl mx-auto">
    <TabHeader title="Meu Plano" subtitle="Seu plano atual, mensalidade e o que está incluído" tutorialId="subscription" />
    <StoreSubscriptionTeste storeId={storeId} storeName={storeName} />
  </div>
);

export default SubscriptionTabTeste;
