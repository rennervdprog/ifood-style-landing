import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Clock, Copy, Upload, Loader2, CheckCircle2, AlertTriangle, QrCode } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { formatPixKeyDisplay } from "@/lib/pixFormat";

/**
 * Tela do cliente para pagamento via "Pix Direto".
 * Mostra a chave PIX do lojista, valor, cronômetro (20 min)
 * e permite o cliente enviar o comprovante. Depois de enviado,
 * fica em "aguardando confirmação" e pooling do status do pedido.
 */
const PixDiretoPaymentPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!orderId) return;
    const { data: o } = await supabase
      .from("orders")
      .select("id, store_id, total_price, status, payment_method, pix_expires_at, pix_proof_url, pix_refused_reason")
      .eq("id", orderId)
      .maybeSingle();
    if (!o) { toast.error("Pedido não encontrado"); navigate("/pedidos"); return; }
    setOrder(o);
    const { data: s } = await supabase
      .from("stores_public")
      .select("name, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions")
      .eq("id", (o as any).store_id)
      .maybeSingle();
    setStore(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  // Cronômetro + polling do status
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!orderId) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [orderId]);

  const expiresAt = order?.pix_expires_at ? new Date(order.pix_expires_at).getTime() : null;
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);
  const expired = expiresAt !== null && remainingMs === 0 && order?.status === "aguardando_comprovante";

  const status: string = order?.status || "";
  const proofSent = status === "comprovante_enviado";
  const confirmed = ["preparando", "pronto_para_entrega", "em_entrega", "entregue"].includes(status);
  const refused = status === "pix_direto_recusado";
  const canceled = status === "cancelado";

  const keyDisplay = useMemo(
    () => formatPixKeyDisplay(store?.pix_direto_key || "", store?.pix_direto_key_type || ""),
    [store]
  );

  const handleCopy = async () => {
    const ok = await copyToClipboard(store?.pix_direto_key || "");
    if (ok) toast.success("Chave PIX copiada!");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    const okTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!okTypes.includes(file.type)) { toast.error("Envie JPG, PNG ou PDF"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${order.store_id}/${order.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("pix-proofs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: rpcErr } = await (supabase as any).rpc("attach_pix_proof", {
        p_order_id: order.id,
        p_proof_path: path,
      });
      if (rpcErr) throw rpcErr;
      toast.success("Comprovante enviado! Aguarde a confirmação da loja.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar comprovante");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (confirmed) {
      toast.success("Pagamento confirmado pela loja! 🎉");
      const t = setTimeout(() => navigate("/pedidos?new_order=1", { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [confirmed, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate("/pedidos")} className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground flex-1">Pagamento via Pix Direto</h1>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Pagando para</p>
          <p className="text-lg font-black text-foreground">{store?.name}</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Valor</span>
            <span className="text-2xl font-black text-primary">{formatBRL(Number(order?.total_price || 0))}</span>
          </div>
        </div>

        {!proofSent && !confirmed && !refused && !canceled && (
          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${expired ? "border-destructive/40 bg-destructive/10" : "border-amber-500/30 bg-amber-500/10"}`}>
            <Clock className={`h-5 w-5 ${expired ? "text-destructive" : "text-amber-600"}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${expired ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                {expired ? "Tempo esgotado" : "Envie o comprovante em"}
              </p>
              {!expired && (
                <p className="text-2xl font-black tabular-nums text-amber-700 dark:text-amber-400">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Chave PIX da loja</h2>
          </div>
          {store?.pix_direto_beneficiary && (
            <p className="text-xs text-muted-foreground">Beneficiário: <span className="font-bold text-foreground">{store.pix_direto_beneficiary}</span></p>
          )}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{store?.pix_direto_key_type}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-muted rounded-xl px-3 py-2.5 text-sm font-mono truncate">{keyDisplay || "—"}</div>
            <button onClick={handleCopy} className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0" title="Copiar">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          {store?.pix_direto_instructions && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-line">{store.pix_direto_instructions}</p>
          )}
        </div>

        {confirmed ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Pagamento confirmado!</p>
              <p className="text-xs text-emerald-700/80">Seu pedido já está em preparo.</p>
            </div>
          </div>
        ) : refused ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-bold text-destructive">Comprovante recusado</p>
            </div>
            {order?.pix_refused_reason && (
              <p className="text-xs text-destructive/90">{order.pix_refused_reason}</p>
            )}
          </div>
        ) : canceled ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm font-bold text-destructive">Pedido cancelado</p>
          </div>
        ) : proofSent ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-bold text-primary">Aguardando confirmação da loja</p>
              <p className="text-xs text-muted-foreground">Assim que confirmarem o recebimento, seu pedido entra em preparo.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || expired}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-4 rounded-2xl disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {uploading ? "Enviando..." : "Enviar comprovante do PIX"}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">JPG, PNG ou PDF · até 5 MB</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PixDiretoPaymentPage;