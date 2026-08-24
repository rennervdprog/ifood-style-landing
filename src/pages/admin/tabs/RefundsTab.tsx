import AdminRefundPanel from "@/components/AdminRefundPanel";

interface Props {
  storeId: string;
}

const RefundsTab = ({ storeId }: Props) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-black text-foreground">Casos de devolução PIX Direto</h2>
      <p className="text-xs text-muted-foreground">
        Acompanhe a resposta da loja, a devolução direta ao cliente e os comprovantes
      </p>
    </div>
    <AdminRefundPanel storeId={storeId} />
  </div>
);

export default RefundsTab;