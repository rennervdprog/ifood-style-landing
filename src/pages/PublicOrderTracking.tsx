// Acompanhamento público de pedido guest — sem login.
// URL: /p/:orderId?t=<últimos4 do WhatsApp>
import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { ArrowLeft, MapPin, MessageCircle, Loader2, CheckCircle2, Clock, Truck, KeyRound, ShieldAlert } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Recebido pela loja", color: "text-blue-600", icon: Clock },
  em_preparo: { label: "Em preparo", color: "text-orange-500", icon: Clock },
  pronto_para_entrega: { label: "Pronto para entrega", color: "text-primary", icon: CheckCircle2 },
  saiu_para_entrega: { label: "A caminho", color: "text-primary", icon: Truck },
  entregue: { label: "Entregue", color: "text-green-600", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-destructive", icon: Clock },
};

const PublicOrderTracking = () => {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const last4 = params.get("t") || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${(supabase as any).supabaseUrl}/functions/v1/guest-order-status?order_id=${orderId}&last4=${last4}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${(supabase as any).supabaseKey}` },
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error || "not_found"); setData(null); }
      else { setData(j); setError(null); }
    } catch (e: any) { setError(e?.message || "erro"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!orderId || last4.length !== 4) { setError("invalid"); setLoading(false); return; }
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, last4]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>;
  }
  if (error || !data) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">Pedido não encontrado ou link inválido.</p>
      <Link to="/" className="text-primary text-sm font-bold">Voltar para o início</Link>
    </div>;
  }

  const s = STATUS_LABEL[data.order.status] || { label: data.order.status, color: "text-foreground", icon: Clock };
  const Icon = s.icon;
  const whats = data.store?.whatsapp_number
    ? `https://wa.me/${String(data.store.whatsapp_number).replace(/\D/g, "")}`
    : null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 bg-card border-b border-border h-14 flex items-center px-4 gap-3">
        <Link to="/" className="p-1 -ml-1"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-base font-bold">Seu pedido</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
          <Icon className={`h-10 w-10 mx-auto ${s.color}`} />
          <p className={`text-lg font-bold ${s.color}`}>{s.label}</p>
          <p className="text-xs text-muted-foreground">Pedido #{String(data.order.id).slice(0, 8)}</p>
          {data.customer_name && <p className="text-sm">Olá, {data.customer_name}</p>}
        </div>

        {data.delivery_pin && data.order.status !== "entregue" && data.order.status !== "cancelado" && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Seu PIN de entrega</p>
                <p className="text-[11px] text-muted-foreground">Informe ao entregador para liberar o pedido</p>
              </div>
            </div>
            <p className="text-4xl font-black tracking-[0.5em] text-center text-primary">{data.delivery_pin}</p>
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">Não compartilhe este código com ninguém além do entregador na hora da entrega.</p>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-bold">{data.store?.name || "Loja"}</h2>
          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{data.order.address_details} — {data.order.neighborhood}</span>
          </div>
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer"
              className="mt-2 w-full h-11 rounded-xl bg-green-500 text-white text-sm font-bold flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4" /> Falar com a loja no WhatsApp
            </a>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-bold">Itens</h2>
          {(data.items || []).map((it: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{it.quantity}× {it.products?.name || "Item"}</span>
              <span>{formatBRL(Number(it.unit_price) * Number(it.quantity))}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <span>Subtotal</span><span>{formatBRL(data.order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Entrega</span><span>{formatBRL(data.order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
            <span>Total</span><span>{formatBRL(data.order.total_price)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">Pagamento: {data.order.payment_method}</p>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">Esta página atualiza sozinha a cada 20s.</p>
      </div>
    </div>
  );
};

export default PublicOrderTracking;