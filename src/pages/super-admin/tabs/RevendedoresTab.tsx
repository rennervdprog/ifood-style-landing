import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Search, Users, Handshake, Wallet, CheckCircle2, XCircle, Ban, Store, DollarSign, Percent, Copy, Zap, ShieldAlert, FileDown,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

type Reseller = {
  id: string; user_id: string; email: string | null; code: string;
  status: "pending" | "approved" | "blocked";
  commission_rate: number; bounty_amount_cents: number;
  pix_key: string | null; pix_key_type: string | null;
  total_referrals: number; active_referrals: number;
  balance_pending_cents: number; total_paid_cents: number;
  created_at: string;
};

type Withdrawal = {
  id: string; reseller_id: string; reseller_code: string; reseller_email: string | null;
  amount_cents: number; pix_key: string; pix_key_type: string;
  status: string; admin_notes: string | null; asaas_transfer_id: string | null;
  processed_at: string | null; created_at: string;
};

const cents = (v: number) => formatBRL((v ?? 0) / 100);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: "Pendente",  cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    approved:  { label: "Aprovado",  cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    blocked:   { label: "Bloqueado", cls: "bg-red-100 text-red-800 border-red-300" },
    rejected:  { label: "Rejeitado", cls: "bg-red-100 text-red-800 border-red-300" },
    paid:      { label: "Pago",      cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  };
  const m = map[s] ?? { label: s, cls: "bg-muted text-foreground" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Falha ao copiar");
  }
};

export default function RevendedoresTab() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"resellers" | "withdrawals" | "commissions">("resellers");
  const [search, setSearch] = useState("");
  const [editReseller, setEditReseller] = useState<Reseller | null>(null);
  const [payDialog, setPayDialog] = useState<Withdrawal | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Withdrawal | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [asaasId, setAsaasId] = useState("");
  const [editCommission, setEditCommission] = useState("");
  const [editBounty, setEditBounty] = useState("");

  const summaryQ = useQuery({
    queryKey: ["admin-reseller-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reseller_summary" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const resellersQ = useQuery({
    queryKey: ["admin-reseller-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reseller_list" as any);
      if (error) throw error;
      return (data as Reseller[]) ?? [];
    },
  });

  const withdrawalsQ = useQuery({
    queryKey: ["admin-reseller-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reseller_withdrawals" as any, { _status: null });
      if (error) throw error;
      return (data as Withdrawal[]) ?? [];
    },
  });

  const commissionsQ = useQuery({
    queryKey: ["admin-reseller-commissions"],
    enabled: tab === "commissions",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reseller_commissions" as any, { _reseller_id: null, _status: null });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const filteredResellers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resellersQ.data ?? [];
    return (resellersQ.data ?? []).filter(r =>
      r.code.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  }, [resellersQ.data, search]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-reseller-summary"] });
    qc.invalidateQueries({ queryKey: ["admin-reseller-list"] });
    qc.invalidateQueries({ queryKey: ["admin-reseller-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["admin-reseller-commissions"] });
  };

  const setStatus = async (r: Reseller, status: "approved" | "blocked" | "pending") => {
    const { error } = await supabase.rpc("admin_reseller_set_status" as any, {
      _reseller_id: r.id, _status: status, _notes: null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Revendedor ${status === "approved" ? "aprovado" : status === "blocked" ? "bloqueado" : "resetado"}`);
    refreshAll();
  };

  const saveConfig = async () => {
    if (!editReseller) return;
    const rate = parseFloat(editCommission.replace(",", "."));
    const bounty = Math.round(parseFloat(editBounty.replace(",", ".")) * 100);
    if (isNaN(rate) || rate < 0 || rate > 1) return toast.error("Taxa entre 0 e 1 (ex: 0.20)");
    if (isNaN(bounty) || bounty < 0) return toast.error("Bounty inválido");
    const { error } = await supabase.rpc("admin_reseller_update_config" as any, {
      _reseller_id: editReseller.id, _commission_rate: rate, _bounty_amount_cents: bounty, _gmv_bonus_rate: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Configuração atualizada");
    setEditReseller(null);
    refreshAll();
  };

  const processWithdrawal = async (id: string, action: "approve" | "paid" | "reject", notes?: string, transferId?: string) => {
    const { error } = await supabase.rpc("admin_reseller_withdrawal_process" as any, {
      _withdrawal_id: id, _action: action, _notes: notes ?? null, _asaas_transfer_id: transferId ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success(action === "paid" ? "Pagamento confirmado" : action === "reject" ? "Solicitação rejeitada" : "Solicitação aprovada");
    setPayDialog(null); setRejectDialog(null); setRejectNotes(""); setAsaasId("");
    refreshAll();
  };

  const s = summaryQ.data ?? {};
  const pendingWithdrawalsCount = (withdrawalsQ.data ?? []).filter(w => w.status === "pending").length;

  const exportPendingCSV = async () => {
    try {
      const [{ data: comms, error: cErr }, { data: resList, error: rErr }] = await Promise.all([
        supabase.rpc("admin_reseller_commissions" as any, { _reseller_id: null, _status: "pending" }),
        supabase.rpc("admin_reseller_list" as any),
      ]);
      if (cErr) throw cErr;
      if (rErr) throw rErr;
      const resMap = new Map<string, Reseller>();
      for (const r of ((resList as Reseller[]) ?? [])) resMap.set(r.code, r);
      type Agg = { code: string; email: string; pix_type: string; pix: string; bounty: number; recurring: number; other: number; count: number; total: number };
      const agg = new Map<string, Agg>();
      for (const c of ((comms as any[]) ?? [])) {
        const code = c.reseller_code ?? "?";
        const r = resMap.get(code);
        const cur: Agg = agg.get(code) ?? {
          code, email: r?.email ?? "", pix_type: r?.pix_key_type ?? "", pix: r?.pix_key ?? "",
          bounty: 0, recurring: 0, other: 0, count: 0, total: 0,
        };
        const amt = Number(c.amount_cents) || 0;
        if (c.type === "bounty") cur.bounty += amt;
        else if (c.type === "recurring") cur.recurring += amt;
        else cur.other += amt;
        cur.total += amt;
        cur.count += 1;
        agg.set(code, cur);
      }
      if (agg.size === 0) {
        toast.info("Nenhuma comissão pendente para exportar.");
        return;
      }
      const esc = (v: unknown) => {
        const str = v == null ? "" : String(v);
        return /[",;\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const header = ["codigo","email","pix_tipo","pix_chave","qtd_comissoes","bounty_brl","recorrente_brl","outros_brl","total_brl"];
      const lines = [header.join(";")];
      let totalBrl = 0;
      for (const v of agg.values()) {
        totalBrl += v.total;
        lines.push([v.code, v.email, v.pix_type, v.pix, v.count, (v.bounty/100).toFixed(2), (v.recurring/100).toFixed(2), (v.other/100).toFixed(2), (v.total/100).toFixed(2)].map(esc).join(";"));
      }
      const csv = "\uFEFF" + lines.join("\n");
      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revendedores_pendentes_${today}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`CSV gerado: ${agg.size} revendedores · ${cents(totalBrl)} a pagar`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar CSV");
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users}    label="Revendedores"    value={String(s.total_resellers ?? 0)} sub={`${s.pending_resellers ?? 0} pendentes`} />
        <KpiCard icon={Store}    label="Lojas indicadas" value={String(s.total_referrals ?? 0)} sub={`${s.active_referrals ?? 0} ativas`} />
        <KpiCard icon={Wallet}   label="A pagar"         value={cents(s.pending_commissions_cents ?? 0)} sub={`${s.pending_withdrawals ?? 0} saques pendentes`} highlight={pendingWithdrawalsCount > 0} />
        <KpiCard icon={DollarSign} label="Total pago"    value={cents(s.paid_commissions_cents ?? 0)} sub="Vitalício" />
      </div>

      {/* Automação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Automação (crons)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            const { data, error } = await supabase.rpc("admin_reseller_run_bounty_cron" as any, { _dry_run: false });
            if (error) return toast.error(error.message);
            toast.success(`Bounty: ${(data as any)?.processed ?? 0} processados`);
            qc.invalidateQueries();
          }}><Zap className="h-3 w-3 mr-1" /> Rodar Bounty</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            const { data, error } = await supabase.rpc("admin_reseller_run_recurring_cron" as any, { _ref_month: null, _dry_run: false });
            if (error) return toast.error(error.message);
            toast.success(`Recorrente ${(data as any)?.ref_month}: ${(data as any)?.processed ?? 0} processados`);
            qc.invalidateQueries();
          }}><Wallet className="h-3 w-3 mr-1" /> Rodar Recorrente (mês anterior)</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            const { data, error } = await supabase.rpc("admin_reseller_run_fraud_cron" as any, { _dry_run: false });
            if (error) return toast.error(error.message);
            const alerts = (data as any)?.alerts?.length ?? 0;
            toast.success(`Anti-fraude: ${alerts} alertas · ${(data as any)?.blocked_resellers ?? 0} bloqueados`);
            qc.invalidateQueries();
          }}><ShieldAlert className="h-3 w-3 mr-1" /> Rodar Anti-fraude</Button>
          <p className="text-xs text-muted-foreground w-full pt-1">
            Crons agendados: bounty 03:00 UTC diário · recorrente dia 5 04:00 UTC · anti-fraude domingo 05:00 UTC
          </p>
        </CardContent>
      </Card>

      {/* Relatório mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Relatório de pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportPendingCSV}>
            <FileDown className="h-3 w-3 mr-1" /> Exportar CSV pendentes
          </Button>
          <p className="text-xs text-muted-foreground">
            Agrupa todas as comissões pendentes por revendedor com chave PIX. Use para pagar em lote e depois marque cada saque como pago.
          </p>
        </CardContent>
      </Card>

      {/* Sub-tabs */}
      <div className="inline-flex gap-1 p-1 bg-muted rounded-xl">
        {([
          { k: "resellers",   label: "Revendedores" },
          { k: "withdrawals", label: `Saques${pendingWithdrawalsCount ? ` (${pendingWithdrawalsCount})` : ""}` },
          { k: "commissions", label: "Comissões" },
        ] as const).map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === t.k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resellers" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Revendedores</CardTitle>
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 h-9" placeholder="Buscar código ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {resellersQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : filteredResellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum revendedor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Código</th>
                      <th className="pr-3">Email</th>
                      <th className="pr-3">Status</th>
                      <th className="pr-3">Comissão</th>
                      <th className="pr-3">Bounty</th>
                      <th className="pr-3">Lojas</th>
                      <th className="pr-3">Saldo</th>
                      <th className="pr-3">Pago</th>
                      <th className="pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResellers.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono font-bold">{r.code}</td>
                        <td className="pr-3">{r.email ?? "—"}</td>
                        <td className="pr-3">{statusBadge(r.status)}</td>
                        <td className="pr-3">{(Number(r.commission_rate) * 100).toFixed(1)}%</td>
                        <td className="pr-3">{cents(r.bounty_amount_cents)}</td>
                        <td className="pr-3">{r.active_referrals}/{r.total_referrals}</td>
                        <td className="pr-3 font-bold text-emerald-600">{cents(r.balance_pending_cents)}</td>
                        <td className="pr-3 text-muted-foreground">{cents(r.total_paid_cents)}</td>
                        <td className="pr-3">
                          <div className="flex gap-1 flex-wrap">
                            {r.status !== "approved" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700 border-emerald-300" onClick={() => setStatus(r, "approved")}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                              </Button>
                            )}
                            {r.status !== "blocked" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-300" onClick={() => setStatus(r, "blocked")}>
                                <Ban className="h-3 w-3 mr-1" /> Bloquear
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => {
                              setEditReseller(r);
                              setEditCommission(String(Number(r.commission_rate)));
                              setEditBounty(((r.bounty_amount_cents ?? 0) / 100).toFixed(2));
                            }}>
                              <Percent className="h-3 w-3 mr-1" /> Config
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "withdrawals" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Saques de revendedores</CardTitle></CardHeader>
          <CardContent>
            {withdrawalsQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : (withdrawalsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Data</th>
                      <th className="pr-3">Revendedor</th>
                      <th className="pr-3">Valor</th>
                      <th className="pr-3">PIX</th>
                      <th className="pr-3">Status</th>
                      <th className="pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(withdrawalsQ.data ?? []).map(w => (
                      <tr key={w.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-xs">{fmtDate(w.created_at)}</td>
                        <td className="pr-3">
                          <div className="font-mono font-bold text-xs">{w.reseller_code}</div>
                          <div className="text-xs text-muted-foreground">{w.reseller_email ?? "—"}</div>
                        </td>
                        <td className="pr-3 font-bold">{cents(w.amount_cents)}</td>
                        <td className="pr-3 text-xs">
                          <div className="uppercase text-muted-foreground">{w.pix_key_type}</div>
                          <div className="font-mono">{w.pix_key}</div>
                        </td>
                        <td className="pr-3">{statusBadge(w.status)}</td>
                        <td className="pr-3">
                          {w.status === "pending" && (
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard(w.pix_key, "Chave PIX")}>
                                <Copy className="h-3 w-3 mr-1" /> PIX
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard((w.amount_cents / 100).toFixed(2), "Valor")}>
                                <Copy className="h-3 w-3 mr-1" /> Valor
                              </Button>
                              <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setPayDialog(w); setAsaasId(""); }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar pago
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-300" onClick={() => { setRejectDialog(w); setRejectNotes(""); }}>
                                <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                              </Button>
                            </div>
                          )}
                          {w.status !== "pending" && w.admin_notes && (
                            <div className="text-xs text-muted-foreground max-w-xs truncate" title={w.admin_notes}>{w.admin_notes}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "commissions" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comissões (últimas 500)</CardTitle></CardHeader>
          <CardContent>
            {commissionsQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : (commissionsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma comissão registrada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Data</th>
                      <th className="pr-3">Revendedor</th>
                      <th className="pr-3">Loja</th>
                      <th className="pr-3">Tipo</th>
                      <th className="pr-3">Ref</th>
                      <th className="pr-3">Valor</th>
                      <th className="pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(commissionsQ.data ?? []).map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-xs">{fmtDate(c.created_at)}</td>
                        <td className="pr-3 font-mono text-xs">{c.reseller_code}</td>
                        <td className="pr-3">{c.store_name ?? "—"}</td>
                        <td className="pr-3"><Badge variant="outline" className="text-xs">{c.type}</Badge></td>
                        <td className="pr-3 text-xs text-muted-foreground">{c.reference_month ?? "—"}</td>
                        <td className="pr-3 font-bold">{cents(c.amount_cents)}</td>
                        <td className="pr-3">{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Config dialog */}
      <Dialog open={!!editReseller} onOpenChange={(o) => !o && setEditReseller(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuração — {editReseller?.code}</DialogTitle>
            <DialogDescription>Ajuste comissão vitalícia e bounty de ativação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Taxa de comissão (0 a 1)</label>
              <Input value={editCommission} onChange={(e) => setEditCommission(e.target.value)} placeholder="0.20" />
              <p className="text-[10px] text-muted-foreground mt-1">Ex: 0.20 = 20% recorrente sobre MRR.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Bounty por ativação (R$)</label>
              <Input value={editBounty} onChange={(e) => setEditBounty(e.target.value)} placeholder="150.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReseller(null)}>Cancelar</Button>
            <Button onClick={saveConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay withdrawal dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              Marcar como pago o saque de <b>{cents(payDialog?.amount_cents ?? 0)}</b> para <b>{payDialog?.reseller_code}</b>.
              As comissões pendentes até esse valor serão baixadas automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-xs">
              <div className="uppercase text-muted-foreground">{payDialog?.pix_key_type}</div>
              <div className="font-mono">{payDialog?.pix_key}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">ID da transferência (opcional)</label>
              <Input value={asaasId} onChange={(e) => setAsaasId(e.target.value)} placeholder="Ex: transferência Asaas / banco" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => payDialog && processWithdrawal(payDialog.id, "paid", null as any, asaasId || undefined)}>Confirmar pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar saque</DialogTitle>
            <DialogDescription>Motivo será enviado ao revendedor.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Motivo da rejeição…" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectDialog && processWithdrawal(rejectDialog.id, "reject", rejectNotes || "Rejeitado sem motivo informado")}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, highlight }: { icon: any; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-amber-400 bg-amber-50/40" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}