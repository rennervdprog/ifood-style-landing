import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Edit3 } from "lucide-react";
import confetti from "canvas-confetti";
import AddressModal from "@/components/AddressModal";
import SavedAddressPicker from "@/components/SavedAddressPicker";

const paymentMethods = [
  { id: "pix", label: "PIX Online (Mercado Pago)", icon: QrCode },
  { id: "cartao", label: "Cartão (Entrega)", icon: CreditCard },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
];

const CheckoutPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, clearCart, setNeighborhood } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [savedAddressData, setSavedAddressData] = useState<any>(null);

  // Load user profile with address
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile-checkout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("street, number, complement, neighborhood, reference_point, phone, whatsapp_number")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Load neighborhood fees for syncing
  const { data: neighborhoodFees } = useQuery({
    queryKey: ["neighborhoods-checkout"],
    queryFn: async () => {
      const { data } = await supabase.from("neighborhood_fees").select("*").order("name");
      return data || [];
    },
  });

  // Sync profile neighborhood with cart if not set
  const profileNeighborhood = (userProfile as any)?.neighborhood;
  const profileStreet = (userProfile as any)?.street;
  const profileNumber = (userProfile as any)?.number;
  const profileComplement = (userProfile as any)?.complement;
  const profileReference = (userProfile as any)?.reference_point;
  const hasAddress = !!profileStreet && !!profileNumber && !!profileNeighborhood;

  // Build address string from profile
  const buildAddressString = () => {
    if (!hasAddress) return "";
    const parts = [profileStreet, profileNumber];
    if (profileComplement) parts.push(profileComplement);
    if (profileReference) parts.push(`Ref: ${profileReference}`);
    return parts.join(", ");
  };

  const addressString = buildAddressString();

  // Sync neighborhood fee from profile if cart doesn't have one yet
  useEffect(() => {
    if (profileNeighborhood && !neighborhood && neighborhoodFees) {
      const found = neighborhoodFees.find((n: any) => n.name === profileNeighborhood);
      if (found) {
        setNeighborhood(found.name, found.fee);
      }
    }
  }, [profileNeighborhood, neighborhood, neighborhoodFees, setNeighborhood]);

  // Redirect to login if not authenticated
  if (!user) {
    navigate("/auth", { state: { from: "/checkout" }, replace: true });
    return null;
  }

  if (items.length === 0) {
    navigate("/carrinho", { replace: true });
    return null;
  }

  const handleConfirm = async () => {
    if (!hasAddress) {
      setShowAddressModal(true);
      return;
    }
    if (!neighborhood) {
      toast.error("Selecione um bairro no seu perfil antes de finalizar.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (paymentMethod === "dinheiro" && needsChange) {
      const changeValue = parseFloat(changeFor);
      if (!changeValue || changeValue < total) {
        toast.error("O valor do troco deve ser maior que o total do pedido.");
        return;
      }
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

        const changeValue = paymentMethod === "dinheiro" && needsChange ? parseFloat(changeFor) : 0;
        const orderStatus = paymentMethod === "pix" ? "aguardando_pagamento" : "pendente";
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
            neighborhood: profileNeighborhood || neighborhood,
            address_details: addressString,
            needs_change: paymentMethod === "dinheiro" && needsChange,
            change_for: changeValue,
            status: orderStatus,
          } as any)
          .select("id")
          .single();

        if (orderError) throw orderError;

        const orderItems = storeItems.map((item) => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          addons: item.addons && item.addons.length > 0 ? JSON.stringify(item.addons) : null,
          observations: item.observations || null,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // If PIX, the order was created with status "aguardando_pagamento"
      // The client will see it in "Meus Pedidos" and can generate PIX from there
      if (paymentMethod === "pix") {
        clearCart();
        toast.success("Pedido criado! Acesse 'Meus Pedidos' para pagar com PIX.", { duration: 5000 });
        navigate("/pedidos");
        return;
      }

      clearCart();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      toast.success("Pedido enviado com sucesso! Acompanhe o status agora.");
      navigate("/pedidos", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Finalizar Pedido</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Delivery address - auto-loaded from profile */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Endereço de entrega
          </h2>
          {hasAddress ? (
            <div className="bg-card rounded-xl border border-border p-3 space-y-1">
              <p className="text-sm font-bold text-foreground">
                {profileStreet}, {profileNumber}
                {profileComplement ? ` - ${profileComplement}` : ""}
              </p>
              <p className="text-sm text-foreground">
                {profileNeighborhood}
              </p>
              {profileReference && (
                <p className="text-xs text-muted-foreground">
                  📍 Ref: {profileReference}
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-primary">
                  Taxa de entrega: R$ {neighborhoodFee.toFixed(2)}
                </span>
                <button
                  onClick={() => navigate("/perfil")}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <Edit3 className="h-3 w-3" />
                  Alterar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-yellow-600 mb-2">
                📍 Endereço não cadastrado
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Precisamos do seu endereço para entregar pelo FoodIta.
              </p>
              <button
                onClick={() => setShowAddressModal(true)}
                className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-xl text-sm"
              >
                Cadastrar Endereço
              </button>
            </div>
          )}
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
                onClick={() => {
                  setPaymentMethod(pm.id);
                  if (pm.id !== "dinheiro") {
                    setNeedsChange(false);
                    setChangeFor("");
                  }
                }}
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

          {/* Cash change section */}
          {paymentMethod === "dinheiro" && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mt-3 space-y-3">
              <p className="text-xs text-yellow-600 font-bold">
                💰 Prepare o valor exato ou informe o troco para agilizar.
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={needsChange}
                  onChange={(e) => setNeedsChange(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">Preciso de troco</span>
              </label>
              {needsChange && (
                <div>
                  <label className="text-xs text-muted-foreground">Troco para quanto?</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 50, 100"
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {changeFor && parseFloat(changeFor) >= total && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Troco: <span className="font-bold text-foreground">R$ {(parseFloat(changeFor) - total).toFixed(2)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="border-t border-border pt-4 space-y-2">
          <h2 className="text-sm font-bold text-foreground mb-2">Resumo</h2>
          {items.map((item) => (
            <div key={item.cartKey || item.id} className="flex justify-between text-sm">
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
            <span className="text-muted-foreground">Entrega ({profileNeighborhood || neighborhood})</span>
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
          onSaved={() => {
            setShowAddressModal(false);
            refetchProfile();
          }}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
