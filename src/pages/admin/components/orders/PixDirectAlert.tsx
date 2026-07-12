import { useState } from "react";
import { QrCode, MessageCircle, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  pixPending: any[];
  pixBusyId: string | null;
  onOpenProof: (o: any) => void;
  onConfirm: (o: any) => Promise<void> | void;
  onConfirmExternal: (o: any) => Promise<void> | void;
  onRefuse: (o: any) => Promise<void> | void;
  pixProofPreview: { url: string; order: any } | null;
  setPixProofPreview: (v: { url: string; order: any } | null) => void;
}

export default function PixDirectAlert({
  pixPending, pixBusyId, onOpenProof, onConfirm, onConfirmExternal, onRefuse,
  pixProofPreview, setPixProofPreview,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmOrder, setConfirmOrder] = useState<any | null>(null);
  const [waOrder, setWaOrder] = useState<any | null>(null);

  if (pixPending.length === 0 && !pixProofPreview) return null;

  return (
    <>
      {pixProofPreview && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPixProofPreview(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Comprovante Pix</p>
              <p className="text-sm font-bold truncate">
                #{String(pixProofPreview.order.id).slice(0, 6)} · {formatBRL(Number(pixProofPreview.order.total_price || 0))}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPixProofPreview(null); }}
              className="ml-2 rounded-full bg-white/10 hover:bg-white/20 p-2"
              aria-label="Fechar"
            >
              <XCircle className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={pixProofPreview.url} alt="Comprovante Pix" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
          </div>
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/60" onClick={(e) => e.stopPropagation()}>
            <a href={pixProofPreview.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-bold px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
              Abrir original
            </a>
            <button
              onClick={() => { const o = pixProofPreview.order; setPixProofPreview(null); setTimeout(() => setConfirmOrder(o), 50); }}
              className="text-[11px] font-black px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirmar recebimento
            </button>
            <button
              onClick={() => { const o = pixProofPreview.order; setPixProofPreview(null); onRefuse(o); }}
              className="text-[11px] font-bold px-3 py-2 rounded-lg bg-destructive text-destructive-foreground"
            >
              Recusar
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmOrder} onOpenChange={(v) => !v && setConfirmOrder(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento do Pix?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme apenas se o valor de <strong>{confirmOrder ? formatBRL(Number(confirmOrder.total_price || 0)) : ""}</strong> já caiu na sua conta. Essa ação libera o pedido para preparo e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={async () => { const o = confirmOrder; setConfirmOrder(null); if (o) await onConfirm(o); }}
            >
              Sim, recebi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!waOrder} onOpenChange={(v) => !v && setWaOrder(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento via WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Use esta opção apenas se o cliente enviou o comprovante <strong>pelo WhatsApp</strong> (fora do app) e você já confirmou <strong>{waOrder ? formatBRL(Number(waOrder.total_price || 0)) : ""}</strong> na sua conta. O pedido vai direto para preparo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={async () => { const o = waOrder; setWaOrder(null); if (o) await onConfirmExternal(o); }}
            >
              Sim, recebi pelo WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pixPending.length > 0 && (
        <div className="px-4 pt-3 max-w-6xl mx-auto">
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <QrCode className="h-4 w-4 text-primary" />
              <p className="text-xs font-black text-primary uppercase tracking-wide">Pix Direto — aguardando você</p>
              <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                {pixPending.length}
              </span>
              {pixPending.length > 2 && (
                collapsed ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronUp className="h-4 w-4 text-primary" />
              )}
            </button>
            {(!collapsed || pixPending.length <= 2) && (
              <div className="space-y-2">
                {pixPending.map((o: any) => {
                  const proofSent = o.status === "comprovante_enviado";
                  return (
                    <div key={o.id} className="rounded-xl bg-card border border-border p-2.5 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                        <p className="text-xs font-bold text-foreground truncate">
                          #{String(o.id).slice(0, 6)} · {formatBRL(Number(o.total_price || 0))}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {proofSent ? "Comprovante enviado — revise e confirme" : "Aguardando cliente enviar comprovante"}
                        </p>
                      </div>
                      {proofSent && o.pix_proof_url && (
                        <button
                          onClick={() => onOpenProof(o)}
                          className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-muted text-foreground hover:bg-accent"
                        >
                          Ver
                        </button>
                      )}
                      {proofSent && (
                        <>
                          <button
                            onClick={() => setConfirmOrder(o)}
                            disabled={pixBusyId === o.id}
                            className="text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
                          >
                            {pixBusyId === o.id ? "..." : "Confirmar"}
                          </button>
                          <button
                            onClick={() => onRefuse(o)}
                            disabled={pixBusyId === o.id}
                            className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-destructive text-destructive-foreground disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setWaOrder(o)}
                        disabled={pixBusyId === o.id}
                        className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                        title="Cliente enviou comprovante pelo WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" />
                        Recebi no WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}