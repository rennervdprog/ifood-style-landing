import AdminRefundPanel from "@/components/AdminRefundPanel";

interface Props {
  storeId: string;
}

const RefundsTab = ({ storeId }: Props) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-black text-foreground">Solicitações de Reembolso</h2>
      <p className="text-xs text-muted-foreground">
        Gerencie pedidos de reembolso e disputas dos clientes
      </p>
    </div>
    <AdminRefundPanel storeId={storeId} />
  </div>
);

export default RefundsTab;