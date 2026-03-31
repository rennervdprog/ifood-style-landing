import { forwardRef } from "react";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  observations?: string | null;
  addons?: any;
  products?: { name: string } | null;
}

interface OrderReceiptProps {
  order: {
    id: string;
    created_at: string;
    status: string;
    subtotal: number;
    delivery_fee: number;
    total_price: number;
    payment_method: string;
    neighborhood: string;
    address_details: string;
    needs_change?: boolean;
    change_for?: number | null;
    order_items?: OrderItem[];
  };
  storeName: string;
  clientName: string;
}

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const OrderReceipt = forwardRef<HTMLDivElement, OrderReceiptProps>(
  ({ order, storeName, clientName }, ref) => {
    return (
      <div
        ref={ref}
        className="receipt-content"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "12px",
          width: "300px",
          color: "#000",
          background: "#fff",
          padding: "4px",
          position: "fixed",
          left: "-9999px",
          top: "0",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <p style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>
            ItaFood
          </p>
          <p style={{ fontSize: "13px", fontWeight: "bold", margin: "2px 0" }}>
            {storeName}
          </p>
          <p style={{ fontSize: "10px", margin: 0 }}>
            {new Date(order.created_at).toLocaleString("pt-BR")}
          </p>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Order number */}
        <div style={{ textAlign: "center", margin: "6px 0" }}>
          <p style={{ fontSize: "18px", fontWeight: "bold", margin: 0 }}>
            PEDIDO #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Items */}
        <div style={{ marginBottom: "6px" }}>
          {order.order_items?.map((item) => (
            <div key={item.id} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold" }}>
                  {item.quantity}x {item.products?.name || "Item"}
                </span>
                <span>R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
              {/* Addons */}
              {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                <div style={{ paddingLeft: "12px", fontSize: "11px" }}>
                  {item.addons.map((addon: any, i: number) => (
                    <p key={i} style={{ margin: "1px 0" }}>
                      + {addon.name}
                      {addon.price > 0 ? ` (R$ ${Number(addon.price).toFixed(2)})` : ""}
                    </p>
                  ))}
                </div>
              )}
              {/* Observations */}
              {item.observations && (
                <p
                  style={{
                    paddingLeft: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    fontStyle: "italic",
                    margin: "2px 0",
                  }}
                >
                  ⚠ OBS: {item.observations}
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Totals */}
        <div style={{ marginBottom: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal:</span>
            <span>R$ {Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Entrega:</span>
            <span>R$ {Number(order.delivery_fee).toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "14px",
              marginTop: "4px",
            }}
          >
            <span>TOTAL:</span>
            <span>R$ {Number(order.total_price).toFixed(2)}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Payment & delivery info */}
        <div style={{ marginBottom: "6px", fontSize: "11px" }}>
          <p style={{ margin: "2px 0" }}>
            <strong>Pagamento:</strong> {paymentLabels[order.payment_method] || order.payment_method}
          </p>
          {order.payment_method === "dinheiro" && order.needs_change && Number(order.change_for) > 0 && (
            <p style={{ margin: "2px 0", fontWeight: "bold" }}>
              TROCO PARA: R$ {Number(order.change_for).toFixed(2)}
            </p>
          )}
          <p style={{ margin: "2px 0" }}>
            <strong>Cliente:</strong> {clientName}
          </p>
          <p style={{ margin: "2px 0" }}>
            <strong>Bairro:</strong> {order.neighborhood}
          </p>
          <p style={{ margin: "2px 0" }}>
            <strong>Endereço:</strong> {order.address_details}
          </p>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "10px" }}>
          <p style={{ margin: "2px 0" }}>Obrigado pela preferência!</p>
          <p style={{ margin: "2px 0" }}>ItaFood</p>
        </div>

        <div style={{ height: "16px" }} />
      </div>
    );
  }
);

OrderReceipt.displayName = "OrderReceipt";

export default OrderReceipt;
