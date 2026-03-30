import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode } from "lucide-react";
import confetti from "canvas-confetti";
import AddressModal from "@/components/AddressModal";

const paymentMethods = [
  { id: "pix", label: "PIX (App)", icon: QrCode },
  { id: "cartao", label: "Cartão (Entrega)", icon: CreditCard },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
];

const CheckoutPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addressDetails, setAddressDetails] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Check if user has address
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile-address", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("street, number, neighborhood, reference_point").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const hasAddress = !!(userProfile as any)?.street && !!(userProfile as any)?.number;

  // Redirect to login if not authenticated
  if (!user) {
    navigate("/auth", { state: { from: "/checkout" }, replace: true });
    return null;
  }

  if (items.length === 0) {
    navigate("/carrinho", { replace: true });
    return null;
  }

  if (!neighborhood) {
    toast.error("Selecione um bairro antes de finalizar.");
    navigate("/carrinho", { replace: true });
    return null;
  }

  const handleConfirm = async () => {
    if (!addressDetails.trim()) {
      toast.error("Informe seu endereço e ponto de referência.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }

    setLoading(true);
    try {
      // Group items by store
      const storeGroups = items.reduce((acc, item) => {
        if (!acc[item.store_id]) acc[item.store_id] = [];
        acc[item.store_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      for (const [storeId, storeItems] of Object.entries(storeGroups)) {
        const storeSubtotal = storeItems.reduce((s, i) => s + i.price * i.quantity, 0);
        const appFee = Math.round(storeSubtotal * 0.12 * 100) / 100;
        const storeTotalPrice = storeSubtotal + neighborhoodFee;

        // Insert order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            client_id: user.id,
            store_id: storeId,
            subtotal: storeSubtotal,
            delivery_fee: neighborhoodFee,
            total_price: storeTotalPrice,
            app_fee: appFee,
            payment_method: paymentMethod,
            neighborhood: neighborhood,
            address_details: addressDetails.trim(),
          } as any)
          .select("id")
          .single();

        if (orderError) throw orderError;

        // Insert order items
        const orderItems = storeItems.map((item) => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // Success!
      clearCart();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.7 },
      });
      toast.success("Pedido enviado com sucesso! Acompanhe o status agora.");
      navigate("/pedidos", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Finalizar Pedido</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Delivery info */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Endereço de entrega
          </h2>
          <div className="bg-card rounded-xl border border-border p-3 mb-2">
            <span className="text-sm text-muted-foreground">Bairro: </span>
            <span className="text-sm font-bold text-foreground">{neighborhood}</span>
          </div>
          <textarea
            placeholder="Rua, número e ponto de referência..."
            value={addressDetails}
            onChange={(e) => setAddressDetails(e.target.value)}
            className="w-full h-24 px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
            inputMode="text"
          />
        </div>

        {/* Payment method */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-primary" />
            Forma de pagamento
          </h2>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPaymentMethod(pm.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  paymentMethod === pm.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card"
                }`}
              >
                <pm.icon
                  className={`h-5 w-5 ${
                    paymentMethod === pm.id ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-sm font-bold ${
                    paymentMethod === pm.id ? "text-primary" : "text-foreground"
                  }`}
                >
                  {pm.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div className="border-t border-border pt-4 space-y-2">
          <h2 className="text-sm font-bold text-foreground mb-2">Resumo</h2>
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}x {item.name}
              </span>
              <span className="font-bold text-foreground">
                R$ {(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold text-foreground">R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Entrega ({neighborhood})</span>
            <span className="font-bold text-foreground">R$ {neighborhoodFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg pt-2 border-t border-border">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-black text-primary">R$ {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Enviando...
            </span>
          ) : (
            "Confirmar Pedido"
          )}
        </button>
      </div>
      {/* Address modal */}
      {showAddressModal && (
        <AddressModal
          onClose={() => setShowAddressModal(false)}
          onSaved={() => { setShowAddressModal(false); refetchProfile(); }}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
