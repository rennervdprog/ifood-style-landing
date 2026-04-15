import { formatBRL } from "@/lib/utils";
import { forwardRef } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";

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
            ItaSuper
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
          {order.order_items?.map((item) => {
            const addons = Array.isArray(item.addons) ? item.addons : [];
            const requiredAddons = addons.filter((a: any) => a?.required && a?.groupName);
            const optionalAddons = addons.filter((a: any) => !(a?.required && a?.groupName));
            const halfAddons = optionalAddons.filter((a: any) => typeof a?.name === "string" && a.name.startsWith("½ "));
            const otherAddons = optionalAddons.filter((a: any) => !(typeof a?.name === "string" && a.name.startsWith("½ ")));

            return (
              <div key={item.id} style={{ marginBottom: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: "bold" }}>
                    {item.quantity}x {getOrderItemDisplayName(item)}
                  </span>
                  <span>{formatBRL((item.unit_price * item.quantity))}</span>
                </div>

                {/* Required addons - highlighted */}
                {requiredAddons.length > 0 && (
                  <div style={{ paddingLeft: "8px", fontSize: "12px", marginTop: "2px" }}>
                    {requiredAddons.map((addon: any, i: number) => (
                      <p key={`req-${i}`} style={{
                        margin: "2px 0",
                        fontWeight: "bold",
                        borderLeft: "3px solid #000",
                        paddingLeft: "6px",
                      }}>
                        ★ {addon.groupName}: {addon.name.toUpperCase()}
                        {addon.price > 0 ? ` (${formatBRL(Number(addon.price))})` : ""}
                      </p>
                    ))}
                  </div>
                )}

                {/* Optional addons */}
                {(halfAddons.length > 0 || otherAddons.length > 0) && (
                  <div style={{ paddingLeft: "12px", fontSize: "11px" }}>
                    {halfAddons.map((addon: any, i: number) => (
                      <p key={`half-${i}`} style={{ margin: "1px 0" }}>
                        + 1½/ {addon.name.replace("½ ", "")}
                        {addon.price > 0 ? ` (${formatBRL(Number(addon.price))})` : ""}
                      </p>
                    ))}
                    {otherAddons.map((addon: any, i: number) => (
                      <p key={`addon-${i}`} style={{ margin: "1px 0" }}>
                        + {addon.name}
                        {addon.price > 0 ? ` (${formatBRL(Number(addon.price))})` : ""}
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
            );
          })}
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        {/* Totals */}
        <div style={{ marginBottom: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal:</span>
            <span>{formatBRL(Number(order.subtotal))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Entrega:</span>
            <span>{formatBRL(Number(order.delivery_fee))}</span>
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
            <span>{formatBRL(Number(order.total_price))}</span>
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
              TROCO PARA: {formatBRL(Number(order.change_for))}
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
          <p style={{ margin: "2px 0" }}>ItaSuper</p>
        </div>

        <div style={{ height: "16px" }} />
      </div>
    );
  }
);

OrderReceipt.displayName = "OrderReceipt";

export default OrderReceipt;
