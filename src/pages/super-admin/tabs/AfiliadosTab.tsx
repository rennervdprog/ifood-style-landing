import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, Wallet, CheckCircle2, Ban, RotateCcw, ChevronDown, ChevronUp,
  Store as StoreIcon, Receipt, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { brl } from "@/components/finance/financeExport";
import { formatDateBR } from "@/lib/affiliatePanel";
import {
  summarizeAffiliateForAdmin,
  type AdminAffiliateRow,
  type AffiliatePayableSummary,
} from "@/lib/superAdminAfiliados";
import { toast } from "sonner";

// ─── Fase 3 do Sistema de Afiliados: aba do super-admin ─────────────────
// Cadastros (aprovar/suspender/reativar), "a pagar" com o clawback
// (crédito já pago de fatura estornada) e o registro atômico do lote.
// Leitura: policies *_select_admin da migration 20261111090000.
// Escrita: SÓ pelas RPCs admin_set_affiliate_status e
// admin_register_affiliate_payout — os números da tela vêm de
// src/lib/superAdminAfiliados.ts, a mesma matemática da RPC.

interface CreditRow {
  id: string;
  affiliate_id: string;
  store_id: string;
  plan_kind: string;
  base_amount: number | string;
  rate_percent: number;
  credit_amount: number | string;
  status: string;
  earned_at: string;
  release_at: string;
  payout_id: string | null;
  compensated_payout_id: string | null;
  compensated_at: string | null;
  invoice_status: string | null;
}

interface PayoutRow {
  id: string;
  affiliate_id: string;
  amount: number | string;
  pix_key: string | null;
  status: string;
  scheduled_for: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
}

interface ReferralRow {
  id: string;
  affiliate_id: string;
  store_id: string;
  source: string;
  created_at: string;
}

interface AdminData {
  affiliates: AdminAffiliateRow[];
  credits: CreditRow[];
  payouts: PayoutRow[];
  referrals: ReferralRow[];
  storeNames: Record<string, string>;
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-[#5B5B64] text-white" },
  approved: { label: "Aprovado", cls: "bg-primary text-primary-foreground" },
  suspended: { label: "Suspenso", cls: "bg-[#B91C1C] text-white" },
  available: { label: "Liberado", cls: "bg-primary text-primary-foreground" },
  paid: { label: "Pago", cls: "bg-[#15803D] text-white" },
  cancelled: { label: "Cancelado", cls: "bg-[#5B5B64] text-white" },
  failed: { label: "Falhou", cls: "bg-[#B91C1C] text-white" },
  scheduled: { label: "Agendado", cls: "bg-[#5B5B64] text-white" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_PILL[status] || { label: status, cls: "bg-[#5B5B64] text-white" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

const AfiliadosTab = () => {
  const qc = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payTargetId, setPayTargetId] = useState<string | null>(null);
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-afiliados"],
    queryFn: async () => {
      const db = supabase as any; // tabelas do programa fora dos tipos gerados
      const [aff, cred, pay, ref] = await Promise.all([
        db.from("affiliates")
          .select("id, user_id, name, email, document, pix_key, payout_day, status, referral_code, terms_accepted_at, approved_at, created_at")
          .order("created_at", { ascending: false }),
        db.from("affiliate_credits")
          .select("id, affiliate_id, store_id, plan_kind, base_amount, rate_percent, credit_amount, status, earned_at, release_at, payout_id, compensated_payout_id, compensated_at, financial_transactions(status)")
          .order("earned_at", { ascending: false }),
        db.from("affiliate_payouts")
          .select("id, affiliate_id, amount, pix_key, status, scheduled_for, paid_at, note, created_at")
          .order("created_at", { ascending: false }),
        db.from("affiliate_referrals")
          .select("id, affiliate_id, store_id, source, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (aff.error) throw aff.error;
      if (cred.error) throw cred.error;
      if (pay.error) throw pay.error;
      if (ref.error) throw ref.error;

      const credits: CreditRow[] = (cred.data || []).map((c: any) => ({
        ...c,
        invoice_status: c.financial_transactions?.status ?? null,
        financial_transactions: undefined,
      }));
      const referrals: ReferralRow[] = ref.data || [];

      const storeIds = Array.from(new Set([
        ...credits.map((c) => c.store_id),
        ...referrals.map((r) => r.store_id),
      ]));
      const storeNames: Record<string, string> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await db.from("stores").select("id, name").in("id", storeIds);
        for (const s of stores || []) storeNames[s.id] = s.name;
      }

      const result: AdminData = {
        affiliates: aff.data || [],
        credits,
        payouts: pay.data || [],
        referrals,
        storeNames,
      };
      return result;
    },
    staleTime: 30_000,
  });

  const affiliates = data?.affiliates || [];
  const credits = data?.credits || [];
  const payouts = data?.payouts || [];
  const referrals = data?.referrals || [];
  const storeNames = data?.storeNames || {};

  const summaryByAffiliate = useMemo(() => {
    const map = new Map<string, AffiliatePayableSummary>();
    for (const a of affiliates) {
      map.set(
        a.id,
        summarizeAffiliateForAdmin(
          a,
          credits.filter((c) => c.affiliate_id === a.id),
          payouts.filter((p) => p.affiliate_id === a.id),
        ),
      );
    }
    return map;
  }, [affiliates, credits, payouts]);

  const pendingAffiliates = affiliates.filter((a) => a.status === "pending");
  const approvedAffiliates = affiliates.filter((a) => a.status === "approved");
  const suspendedAffiliates = affiliates.filter((a) => a.status === "suspended");
  const totalToPayNow = approvedAffiliates.reduce((sum, a) => {
    const s = summaryByAffiliate.get(a.id);
    return sum + (s && s.net > 0 ? s.net : 0);
  }, 0);

  const payTarget = payTargetId
    ? affiliates.find((a) => a.id === payTargetId) || null
    : null;
  const paySummary = payTarget ? summaryByAffiliate.get(payTarget.id) : null;

  async function setStatus(a: AdminAffiliateRow, status: "approved" | "suspended") {
    setActing(`${a.id}:${status}`);
    try {
      const { error } = await (supabase as any).rpc("admin_set_affiliate_status", {
        p_affiliate_id: a.id,
        p_status: status,
      });
      if (error) throw error;
      toast.success(
        status === "approved"
          ? `${displayName(a)} aprovado`
          : `${displayName(a)} suspenso`,
      );
      qc.invalidateQueries({ queryKey: ["superadmin-afiliados"] });
    } catch (e: any) {
      toast.error("Falha ao mudar o status", { description: e.message });
    } finally {
      setActing(null);
    }
  }

  async function confirmPayout() {
    if (!payTarget || !paySummary) return;
    setPaying(true);
    try {
      const { data: result, error } = await (supabase as any).rpc(
        "admin_register_affiliate_payout",
        { p_affiliate_id: payTarget.id, p_note: payNote.trim() || null },
      );
      if (error) throw error;
      const net = Number(result?.net ?? paySummary.net);
      toast.success(`Pagamento de ${brl(net)} registrado para ${displayName(payTarget)}`, {
        description: result?.offset > 0
          ? `Bruto ${brl(Number(result.gross))} − compensação ${brl(Number(result.offset))}`
          : undefined,
      });
      setPayTargetId(null);
      setPayNote("");
      qc.invalidateQueries({ queryKey: ["superadmin-afiliados"] });
    } catch (e: any) {
      toast.error("Falha ao registrar o pagamento", { description: e.message });
    } finally {
      setPaying(false);
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Wallet className="w-4 h-4" /> Programa de afiliados — a pagar agora
          </div>
          <p className="text-3xl font-black text-primary tabular-nums">{brl(totalToPayNow)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingAffiliates.length > 0
              ? `${pendingAffiliates.length} cadastro${pendingAffiliates.length === 1 ? "" : "s"} aguardando aprovação · `
              : ""}
            {approvedAffiliates.length} afiliado{approvedAffiliates.length === 1 ? "" : "s"} aprovado{approvedAffiliates.length === 1 ? "" : "s"}
            {suspendedAffiliates.length > 0
              ? ` · ${suspendedAffiliates.length} suspenso${suspendedAffiliates.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </CardContent>
      </Card>

      {/* Cadastros pendentes */}
      {pendingAffiliates.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4" /> Cadastros pendentes
          </h3>
          {pendingAffiliates.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold">{displayName(a)}</span>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {a.document ? <>Documento {a.document} · </> : null}
                  {a.email ? <>{a.email} · </> : null}
                  Pix {a.pix_key || "—"} · Lote dia {a.payout_day} · Código{" "}
                  <span className="font-bold text-foreground">{a.referral_code}</span> ·
                  Cadastro em {formatDateBR(a.created_at)}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    disabled={acting === `${a.id}:approved`}
                    onClick={() => setStatus(a, "approved")}
                    className="gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === `${a.id}:suspended`}
                    onClick={() => setStatus(a, "suspended")}
                    className="gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" /> Suspender
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* A pagar */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Wallet className="w-4 h-4" /> A pagar
        </h3>
        {approvedAffiliates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum afiliado aprovado ainda. Aprove um cadastro para ele começar a indicar.
            </CardContent>
          </Card>
        ) : (
          approvedAffiliates.map((a) => {
            const s = summaryByAffiliate.get(a.id)!;
            const expanded = expandedId === a.id;
            const myReferrals = referrals.filter((r) => r.affiliate_id === a.id);
            const myCredits = credits.filter((c) => c.affiliate_id === a.id);
            return (
              <Card key={a.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{displayName(a)}</span>
                      <StatusPill status={a.status} />
                      {s.neverReceived && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <ShieldCheck className="w-3 h-3" /> 1º pagamento: revisão manual
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Código <span className="font-bold text-foreground">{a.referral_code}</span> ·
                      Lote dia {a.payout_day} ({formatDateBR(s.nextBatchDate)})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <ValueBox label="Liberado" value={brl(s.available)} />
                    <ValueBox
                      label="A compensar"
                      value={s.toCompensate > 0 ? `− ${brl(s.toCompensate)}` : brl(0)}
                      alert={s.toCompensate > 0}
                    />
                    <ValueBox label="Pendente (30 dias)" value={brl(s.pending)} />
                    <ValueBox label="Já recebido" value={brl(s.receivedTotal)} />
                  </div>
                  {s.toCompensate > 0 && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      "A compensar" = crédito já pago cuja mensalidade foi estornada depois; sai deste lote.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border/60 pt-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-tight">Líquido a pagar</p>
                      <p className="text-lg font-black tabular-nums">{brl(Math.max(0, s.net))}</p>
                      {!s.canPay && s.net < 100 && (
                        <p className="text-[11px] text-muted-foreground">
                          Faltam {brl(s.missingForMin)} para o mínimo de {brl(100)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(expanded ? null : a.id)}
                        className="gap-1"
                      >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === `${a.id}:suspended`}
                        onClick={() => setStatus(a, "suspended")}
                        className="gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" /> Suspender
                      </Button>
                      <Button
                        size="sm"
                        disabled={!s.canPay}
                        onClick={() => { setPayTargetId(a.id); setPayNote(""); }}
                        className="gap-1"
                      >
                        <Receipt className="w-3.5 h-3.5" /> Registrar pagamento
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border/60 pt-3 space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <StoreIcon className="w-3 h-3" /> Lojas indicadas ({myReferrals.length})
                        </p>
                        {myReferrals.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma loja vinculada ainda.</p>
                        ) : (
                          <ul className="space-y-1">
                            {myReferrals.map((r) => (
                              <li key={r.id} className="text-xs flex justify-between gap-2">
                                <span className="font-medium">{storeNames[r.store_id] || "Loja"}</span>
                                <span className="text-muted-foreground">desde {formatDateBR(r.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Créditos recentes
                        </p>
                        {myCredits.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum crédito ainda.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {myCredits.slice(0, 8).map((c) => (
                              <li key={c.id} className="text-xs flex items-center justify-between gap-2">
                                <span className="min-w-0">
                                  <span className="font-medium">{storeNames[c.store_id] || "Loja"}</span>
                                  <span className="text-muted-foreground">
                                    {" "}· {c.plan_kind === "pdv" ? `PDV ${c.rate_percent}%` : "Essencial 100%"}
                                    {c.status === "pending" && <> · libera {formatDateBR(c.release_at)}</>}
                                    {c.compensated_payout_id && (
                                      <> · compensado em {c.compensated_at ? formatDateBR(c.compensated_at) : "lote posterior"}</>
                                    )}
                                    {!c.compensated_payout_id && c.status === "paid" &&
                                      (c.invoice_status === "cancelled" || c.invoice_status === "failed") && (
                                        <> · fatura estornada (a compensar)</>
                                      )}
                                  </span>
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold tabular-nums">{brl(Number(c.credit_amount))}</span>
                                  <StatusPill status={c.status} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Pix {a.pix_key || "—"}
                        {a.approved_at ? <> · Aprovado em {formatDateBR(a.approved_at)}</> : null}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* Suspensos */}
      {suspendedAffiliates.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Ban className="w-4 h-4" /> Suspensos
          </h3>
          {suspendedAffiliates.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{displayName(a)}</span>
                  <StatusPill status={a.status} />
                  <span className="text-xs text-muted-foreground">
                    Código {a.referral_code} · cadastro em {formatDateBR(a.created_at)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === `${a.id}:approved`}
                  onClick={() => setStatus(a, "approved")}
                  className="gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reativar
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Histórico de pagamentos */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Receipt className="w-4 h-4" /> Pagamentos
        </h3>
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado ainda.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <ul className="divide-y divide-border">
                {payouts.map((p) => {
                  const owner = affiliates.find((a) => a.id === p.affiliate_id);
                  return (
                    <li key={p.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">
                          {owner ? displayName(owner) : "Afiliado"}
                          <span className="ml-2 font-black tabular-nums">{brl(Number(p.amount))}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.scheduled_for ? <>Lote de {formatDateBR(p.scheduled_for)} · </> : null}
                          {p.status === "paid" && p.paid_at
                            ? <>Pago em {formatDateBR(p.paid_at)}</>
                            : <>Registrado em {formatDateBR(p.created_at)}</>}
                          {p.note ? <> · Comprovante: {p.note}</> : null}
                        </p>
                      </div>
                      <StatusPill status={p.status} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Modal: registrar pagamento */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o && !paying) setPayTargetId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Faça o Pix no seu banco e confirme aqui — o registro baixa os créditos deste lote de uma vez.
            </DialogDescription>
          </DialogHeader>
          {payTarget && paySummary && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Afiliado</span>
                <span className="font-bold">{displayName(payTarget)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chave Pix</span>
                <span className="font-bold break-all text-right">{payTarget.pix_key || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liberado (bruto)</span>
                <span className="tabular-nums">{brl(paySummary.available)}</span>
              </div>
              {paySummary.toCompensate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">A compensar (estorno)</span>
                  <span className="tabular-nums">− {brl(paySummary.toCompensate)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-bold">Valor do Pix (líquido)</span>
                <span className="font-black text-lg text-primary tabular-nums">{brl(paySummary.net)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lote do dia {payTarget.payout_day} — {formatDateBR(paySummary.nextBatchDate)}.
                {paySummary.neverReceived && " Primeiro pagamento deste afiliado: confira os dados com atenção."}
              </p>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1" htmlFor="pay-note">
                  Comprovante (ID da transação Pix ou observação)
                </label>
                <Input
                  id="pay-note"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ex.: E2E1234567890"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={paying} onClick={() => setPayTargetId(null)}>
              Cancelar
            </Button>
            <Button disabled={paying || !paySummary?.canPay} onClick={confirmPayout} className="gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {paying ? "Registrando…" : "Já fiz o Pix — registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function displayName(a: AdminAffiliateRow): string {
  return a.name || a.email || "Afiliado sem nome";
}

function ValueBox({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-bold leading-tight tabular-nums ${alert ? "text-[#B91C1C]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default AfiliadosTab;
