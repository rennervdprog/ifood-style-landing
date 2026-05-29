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
            let rawAddons = item.addons;
            if (typeof rawAddons === "string") {
              try { rawAddons = JSON.parse(rawAddons); } catch { rawAddons = []; }
            }
            const addons = Array.isArray(rawAddons) ? rawAddons : [];
            const addonsTotal = addons.reduce((s: number, a: any) => s + (Number(a?.price) || 0), 0);
            const baseUnitPrice = item.unit_price - addonsTotal;
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
                  <span>{formatBRL(baseUnitPrice * item.quantity)}</span>
                </div>

                {/* Required addons - highlighted, name and value side by side */}
                {requiredAddons.length > 0 && (
                  <div style={{ paddingLeft: "8px", fontSize: "12px", marginTop: "2px" }}>
                    {requiredAddons.map((addon: any, i: number) => (
                      <div key={`req-${i}`} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        margin: "3px 0",
                        fontWeight: "bold",
                        fontSize: "12px",
                        border: "1px solid #000",
                        padding: "2px 6px",
                        background: "#eee",
                      }}>
                        <span>★ {addon.groupName}: {addon.name.toUpperCase()}</span>
                        <span>{Number(addon.price) > 0 ? formatBRL(Number(addon.price)) : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional addons - name and value side by side */}
                {(halfAddons.length > 0 || otherAddons.length > 0) && (
                  <div style={{ paddingLeft: "12px", fontSize: "11px" }}>
                    {halfAddons.map((addon: any, i: number) => (
                      <div key={`half-${i}`} style={{ display: "flex", justifyContent: "space-between", margin: "1px 0" }}>
                        <span>+ ½ {addon.name.replace("½ ", "")}</span>
                        <span>{Number(addon.price) > 0 ? formatBRL(Number(addon.price)) : ""}</span>
                      </div>
                    ))}
                    {otherAddons.map((addon: any, i: number) => (
                      <div key={`addon-${i}`} style={{ display: "flex", justifyContent: "space-between", margin: "1px 0" }}>
                        <span>+ {addon.name}</span>
                        <span>{Number(addon.price) > 0 ? formatBRL(Number(addon.price)) : ""}</span>
                      </div>
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
          {Number(order.delivery_fee) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Taxa operacional:</span>
              <span>{formatBRL(Number(order.delivery_fee))}</span>
            </div>
          )}
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

        {/* Menção obrigatória Asaas — Resolução Conjunta nº 16/2025 */}
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ textAlign: "center", fontSize: "8px", color: "#666" }}>
          <p style={{ margin: "2px 0" }}>
            Serviços financeiros processados por
          </p>
          <p style={{ margin: "2px 0", fontWeight: "bold" }}>
            Asaas Gestão Financeira Instituição de Pagamento S.A.
          </p>
          <p style={{ margin: "2px 0" }}>
            Instituição autorizada pelo Banco Central do Brasil
          </p>
        </div>

        <div style={{ height: "16px" }} />
      </div>
    );
  }
);

OrderReceipt.displayName = "OrderReceipt";

export default OrderReceipt;
