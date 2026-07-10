// Acompanhamento público de pedido guest — sem login.
// URL: /p/:orderId?t=<últimos4 do WhatsApp>
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { ArrowLeft, MapPin, MessageCircle, Loader2, CheckCircle2, Clock, Truck, KeyRound, ShieldAlert, QrCode, Copy, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { formatPixKeyDisplay } from "@/lib/pixFormat";

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Recebido pela loja", color: "text-blue-600", icon: Clock },
  em_preparo: { label: "Em preparo", color: "text-orange-500", icon: Clock },
  preparando: { label: "Em preparo", color: "text-orange-500", icon: Clock },
  aguardando_comprovante: { label: "Aguardando pagamento (Pix Direto)", color: "text-amber-600", icon: Clock },
  comprovante_enviado: { label: "Comprovante enviado — aguardando loja", color: "text-primary", icon: Loader2 },
  pix_direto_recusado: { label: "Comprovante recusado", color: "text-destructive", icon: AlertTriangle },
  pronto_para_entrega: { label: "Pronto para entrega", color: "text-primary", icon: CheckCircle2 },
  saiu_para_entrega: { label: "A caminho", color: "text-primary", icon: Truck },
  entregue: { label: "Entregue", color: "text-green-600", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-destructive", icon: Clock },
};

const PublicOrderTracking = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const last4 = params.get("t") || "";
  const navPin = (location.state as any)?.delivery_pin || null;
  const [data, setData] = useState<any>(navPin ? { delivery_pin: navPin } : null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${(supabase as any).supabaseUrl}/functions/v1/guest-order-status?order_id=${orderId}&last4=${last4}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${(supabase as any).supabaseKey}` },
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error || "not_found"); setData((prev: any) => prev?.delivery_pin ? prev : null); }
      else { setData({ ...j, delivery_pin: j?.delivery_pin || navPin }); setError(null); }
    } catch (e: any) { setError(e?.message || "erro"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!orderId || last4.length !== 4) { setError("invalid"); setLoading(false); return; }
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, last4, navPin]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const order = data?.order;
  const store = data?.store;
  const isPixDireto = order?.payment_method === "pix_direto";
  const pixExpiresAt = order?.pix_expires_at ? new Date(order.pix_expires_at).getTime() : null;
  const pixRemainingMs = pixExpiresAt ? Math.max(0, pixExpiresAt - now) : 0;
  const pixMM = Math.floor(pixRemainingMs / 60000);
  const pixSS = Math.floor((pixRemainingMs % 60000) / 1000);
  const pixExpired = pixExpiresAt !== null && pixRemainingMs === 0 && order?.status === "aguardando_comprovante";
  const keyDisplay = useMemo(
    () => formatPixKeyDisplay(store?.pix_direto_key || "", store?.pix_direto_key_type || ""),
    [store?.pix_direto_key, store?.pix_direto_key_type]
  );

  const copyKey = async () => {
    const ok = await copyToClipboard(store?.pix_direto_key || "");
    if (ok) toast.success("Chave PIX copiada!");
  };

  const uploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    const okTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!okTypes.includes(file.type)) { toast.error("Envie JPG, PNG ou PDF"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploading(true);
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const { data: res, error: err } = await supabase.functions.invoke("guest-pix-proof-upload", {
        body: { order_id: orderId, last4, content_type: file.type, ext, file_base64: b64 },
      });
      if (err) throw err;
      if (!(res as any)?.ok) throw new Error((res as any)?.error || "Erro ao enviar comprovante");
      toast.success("Comprovante enviado! Aguarde a confirmação da loja.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar comprovante");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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

        {isPixDireto && ["aguardando_comprovante", "comprovante_enviado", "pix_direto_recusado"].includes(order.status) && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Pagamento via Pix Direto</h2>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Valor</span>
              <span className="text-xl font-black text-primary">{formatBRL(Number(order.total_price || 0))}</span>
            </div>
            {store?.pix_direto_beneficiary && (
              <p className="text-xs text-muted-foreground">Beneficiário: <span className="font-bold text-foreground">{store.pix_direto_beneficiary}</span></p>
            )}
            {store?.pix_direto_key_type && (
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{store.pix_direto_key_type}</p>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-muted rounded-xl px-3 py-2.5 text-sm font-mono truncate">{keyDisplay || "—"}</div>
              <button onClick={copyKey} className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0" title="Copiar">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {store?.pix_direto_instructions && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-line">{store.pix_direto_instructions}</p>
            )}

            {order.status === "aguardando_comprovante" && (
              <>
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${pixExpired ? "border-destructive/40 bg-destructive/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                  <Clock className={`h-4 w-4 ${pixExpired ? "text-destructive" : "text-amber-600"}`} />
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${pixExpired ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                      {pixExpired ? "Tempo esgotado" : "Envie o comprovante em"}
                    </p>
                    {!pixExpired && pixExpiresAt !== null && (
                      <p className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-400">
                        {String(pixMM).padStart(2, "0")}:{String(pixSS).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={uploadProof} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || pixExpired}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando..." : "Enviar comprovante do PIX"}
                </button>
                <p className="text-[11px] text-center text-muted-foreground">JPG, PNG ou PDF · até 5 MB</p>
              </>
            )}

            {order.status === "comprovante_enviado" && (
              <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 flex items-center gap-3">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <div>
                  <p className="text-xs font-bold text-primary">Aguardando confirmação da loja</p>
                  <p className="text-[11px] text-muted-foreground">Assim que confirmarem, seu pedido entra em preparo.</p>
                </div>
              </div>
            )}

            {order.status === "pix_direto_recusado" && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-bold text-destructive">Comprovante recusado</p>
                </div>
                {order.pix_refused_reason && (
                  <p className="text-[11px] text-destructive/90">{order.pix_refused_reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {(data.delivery_pin || data.order.delivery_pin) && data.order.status !== "entregue" && data.order.status !== "cancelado" && (
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
            <p className="text-4xl font-black tracking-[0.5em] text-center text-primary">{data.delivery_pin || data.order.delivery_pin}</p>
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