import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, LogOut, TrendingUp, Users, Wallet, Loader2, Download, MessageCircle,
  User, Send, QrCode, Zap, ArrowUpRight, Gift, Building2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Reseller = {
  id: string; code: string; status: "pending" | "approved" | "blocked";
  commission_rate: number; bounty_amount_cents: number; gmv_bonus_rate: number;
  pix_key: string | null; pix_key_type: string | null;
};
type Stats = {
  total_referrals: number; active_referrals: number; pending_referrals: number;
  balance_pending_cents: number; balance_paid_cents: number;
  earnings_this_month_cents: number; withdrawn_cents: number; pending_withdrawal_cents: number;
};
type StoreRow = {
  store_id: string; name: string; city: string | null; plan_type: string | null;
  status: string; referral_status: string; activated_at: string | null;
  gmv_60d_cents: number; commissions_total_cents: number;
};
type Commission = {
  id: string; kind: string; amount_cents: number; status: string;
  reference_month: string | null; created_at: string;
};
type Withdrawal = {
  id: string; amount_cents: number; status: string; pix_key: string;
  created_at: string; paid_at: string | null;
};
type Dashboard = {
  registered: boolean;
  reseller?: Reseller;
  stats?: Stats;
  stores?: StoreRow[];
  commissions?: Commission[];
  withdrawals?: Withdrawal[];
};

const brl = (cents: number) =>
  ((cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brlShort = (cents: number) => {
  const v = (cents || 0) / 100;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const planLabel = (p?: string | null) => {
  if (!p) return "—";
  const map: Record<string, string> = {
    essencial: "Essencial",
    autonomia: "Autonomia",
    pdv_only: "PDV Only",
    pdv_addon: "PDV Add-on",
  };
  return map[p] || p;
};

const initialsFromEmail = (email?: string | null) => {
  if (!email) return "RV";
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return (base.slice(0, 2) || "RV").toUpperCase();
};

const font = { sora: "font-['Sora',ui-sans-serif,system-ui]" as const };

export default function ResellerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [wOpen, setWOpen] = useState(false);
  const [wAmount, setWAmount] = useState("");
  const [wLoading, setWLoading] = useState(false);

  // Registro
  const [rCode, setRCode] = useState("");
  const [rPix, setRPix] = useState("");
  const [rType, setRType] = useState<"cpf" | "cnpj" | "email" | "telefone" | "aleatoria">("cpf");
  const [rLoading, setRLoading] = useState(false);

  // Edição de PIX (aba Perfil)
  const [pOpen, setPOpen] = useState(false);
  const [pPix, setPPix] = useState("");
  const [pType, setPType] = useState<"cpf" | "cnpj" | "email" | "telefone" | "aleatoria">("cpf");
  const [pLoading, setPLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) {
      navigate("/revendedor/entrar");
      return;
    }
    setEmail(session.user.email ?? null);
    const { data: dash, error } = await (supabase as any).rpc("reseller_get_dashboard");
    if (error) {
      toast.error("Erro ao carregar painel: " + error.message);
      setLoading(false);
      return;
    }
    setData(dash as Dashboard);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!rPix.trim()) return toast.error("Informe sua chave PIX");
    if (rCode && (rCode.length < 4 || rCode.length > 20))
      return toast.error("Código deve ter entre 4 e 20 caracteres");
    setRLoading(true);
    const { data: res, error } = await (supabase as any).rpc("reseller_register", {
      _code: rCode.trim(),
      _pix_key: rPix.trim(),
      _pix_key_type: rType,
    });
    setRLoading(false);
    if (error) {
      toast.error(
        error.message?.includes("code_taken") ? "Este código já está em uso — escolha outro" :
        error.message?.includes("invalid_code") ? "Código inválido (4 a 20 caracteres)" :
        error.message || "Erro ao registrar"
      );
      return;
    }
    const row = Array.isArray(res) ? res[0] : res;
    toast.success(`Cadastro enviado! Código: ${row?.code}. Aguardando aprovação.`);
    await load();
  };

  const requestWithdrawal = async () => {
    const cents = Math.round(parseFloat(wAmount.replace(",", ".")) * 100);
    if (!cents || cents < 5000) return toast.error("Valor mínimo: R$ 50,00");
    setWLoading(true);
    const { data: res, error } = await (supabase as any).rpc("reseller_request_withdrawal", {
      _amount_cents: cents,
    });
    setWLoading(false);
    if (error || !res?.success) {
      toast.error(res?.error === "insufficient_balance" ? "Saldo insuficiente"
        : res?.error === "no_pix" ? "Cadastre uma chave PIX primeiro"
        : res?.error === "not_approved" ? "Aguarde aprovação para sacar"
        : (error?.message || "Erro ao solicitar"));
      return;
    }
    toast.success("Saque solicitado! Pagamento em até 3 dias úteis.");
    setWOpen(false);
    setWAmount("");
    load();
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/cadastro-lojista?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const savePix = async () => {
    if (!pPix.trim()) return toast.error("Informe a chave PIX");
    setPLoading(true);
    const { error } = await (supabase as any).rpc("reseller_update_pix", {
      _pix_key: pPix.trim(),
      _pix_key_type: pType,
    });
    setPLoading(false);
    if (error) return toast.error(error.message || "Erro ao salvar");
    toast.success("Chave PIX atualizada");
    setPOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6A00]" />
      </div>
    );
  }

  // Ainda não registrado
  if (!data?.registered) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-8 px-4 font-['Manrope',ui-sans-serif,system-ui] text-[#262626]">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8">
            <h2 className={`${font.sora} text-2xl font-bold mb-2`}>Torne-se um revendedor ItaSuper</h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ganhe <strong>20% de comissão vitalícia</strong> sobre o MRR de cada loja indicada,
                mais <strong>R$ 150 de bônus</strong> por loja ativada.
              </p>
              <div>
                <Label>Seu código de indicação (4 a 20 caracteres, sem espaços)</Label>
                <Input value={rCode} onChange={e => setRCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="Ex: JOAOSP" maxLength={20} />
              </div>
              <div>
                <Label>Tipo de chave PIX</Label>
                <select value={rType} onChange={e => setRType(e.target.value as any)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatória</option>
                </select>
              </div>
              <div>
                <Label>Chave PIX (para receber comissões)</Label>
                <Input value={rPix} onChange={e => setRPix(e.target.value)} placeholder="Sua chave" />
              </div>
              <Button onClick={handleRegister} disabled={rLoading} className="w-full bg-[#FF6A00] hover:bg-[#E65F00]">
                {rLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar como revendedor
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Sujeito à aprovação do time ItaSuper (até 48h úteis).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const r = data.reseller!;
  const s = data.stats!;
  const stores = data.stores || [];
  const commissions = data.commissions || [];
  const withdrawals = data.withdrawals || [];
  const isPending = r.status === "pending";
  const isBlocked = r.status === "blocked";
  const available = s.balance_pending_cents + s.balance_paid_cents - s.withdrawn_cents - s.pending_withdrawal_cents;

  // Agregar MRR dos últimos 6 meses a partir das comissões
  const mrrSeries = (() => {
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), total: 0 });
    }
    for (const c of commissions) {
      const dt = c.reference_month ? new Date(c.reference_month) : new Date(c.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find(m => m.key === key);
      if (bucket) bucket.total += c.amount_cents;
    }
    return months.map(m => ({ month: m.label, valor: m.total / 100 }));
  })();

  const referralUrl = `${window.location.origin}/cadastro-lojista?ref=${r.code}`;
  const whatsShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Conheça o ItaSuper — sistema de delivery próprio pra sua loja. Cadastre-se pelo meu link: ${referralUrl}`
  )}`;

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] text-[#262626] font-['Manrope',ui-sans-serif,system-ui] pb-16">
      <div className="max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6 flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-14 h-14 rounded-2xl bg-[#FF6A00] flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-100 shrink-0 ${font.sora}`}>
              {initialsFromEmail(email)}
            </div>
            <div className="min-w-0">
              <h1 className={`${font.sora} font-bold text-lg md:text-xl truncate`}>
                Painel do Revendedor
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                  Código: <span className="font-mono">{r.code}</span>
                </span>
                <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  r.status === "approved" ? "text-emerald-600 bg-emerald-50" :
                  isPending ? "text-amber-600 bg-amber-50" :
                  "text-red-600 bg-red-50"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    r.status === "approved" ? "bg-emerald-500" :
                    isPending ? "bg-amber-500" : "bg-red-500"
                  }`}></span>
                  {r.status === "approved" ? "Aprovado" : isPending ? "Em análise" : "Bloqueado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-bold">Saldo Disponível</p>
              <p className={`${font.sora} font-bold text-lg text-[#FF6A00]`}>{brl(Math.max(0, available))}</p>
            </div>
            <Dialog open={wOpen} onOpenChange={setWOpen}>
              <DialogTrigger asChild>
                <button
                  disabled={available < 5000 || isBlocked || isPending}
                  className="bg-[#FF6A00] hover:bg-[#E65F00] disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-5 md:px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md shadow-orange-100 flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" /> Sacar via PIX
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Solicitar saque via PIX</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm">Disponível: <strong>{brl(Math.max(0, available))}</strong></p>
                  <p className="text-xs text-muted-foreground">
                    Chave PIX: <span className="font-mono">{r.pix_key || "—"}</span>
                    {r.pix_key_type && ` (${r.pix_key_type})`}
                  </p>
                  <div>
                    <Label>Valor (R$) — mínimo R$ 50,00</Label>
                    <Input value={wAmount} onChange={e => setWAmount(e.target.value)}
                      placeholder="Ex: 250,00" inputMode="decimal" />
                  </div>
                  <p className="text-xs text-muted-foreground">Pagamento em até 3 dias úteis.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWOpen(false)}>Cancelar</Button>
                  <Button onClick={requestWithdrawal} disabled={wLoading} className="bg-[#FF6A00] hover:bg-[#E65F00]">
                    {wLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar saque
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <button
              onClick={signOut}
              className="p-3 rounded-2xl hover:bg-neutral-100 text-neutral-500"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {isPending && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            ⏳ Cadastro em análise — comissões só passam a ser creditadas após aprovação.
          </div>
        )}
        {isBlocked && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            🚫 Conta bloqueada. Fale com o suporte.
          </div>
        )}

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-6">

          {/* LEFT COLUMN */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white p-5 rounded-3xl border border-neutral-100 flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3" /> Lojas Ativas
                </span>
                <div className="flex items-baseline gap-1">
                  <span className={`${font.sora} font-bold text-2xl`}>{s.active_referrals}</span>
                  <span className="text-xs text-neutral-400">/ {s.total_referrals}</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-neutral-100 flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> MRR Vitalício
                </span>
                <span className={`${font.sora} font-bold text-2xl text-[#FF6A00]`}>
                  {(r.commission_rate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-neutral-100 flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Gift className="h-3 w-3" /> Bônus / Loja
                </span>
                <span className={`${font.sora} font-bold text-2xl`}>
                  {brl(r.bounty_amount_cents)}
                </span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-neutral-100 flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Total Recebido
                </span>
                <span className={`${font.sora} font-bold text-2xl`}>
                  {brl(s.withdrawn_cents)}
                </span>
              </div>
            </div>

            {/* MRR Chart */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200">
              <div className="flex justify-between items-start mb-6 gap-3">
                <div>
                  <h3 className={`${font.sora} font-bold text-lg`}>Evolução MRR</h3>
                  <p className="text-xs text-neutral-400">Comissões dos últimos 6 meses</p>
                </div>
                <div className="px-3 py-1 bg-orange-50 text-[#FF6A00] rounded-lg text-xs font-bold border border-orange-100 whitespace-nowrap">
                  +{brl(s.earnings_this_month_cents)} este mês
                </div>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrSeries} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6A00" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#FF6A00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 700 }} />
                    <YAxis tickLine={false} axisLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Comissões"]}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#FF6A00" strokeWidth={3}
                      fill="url(#mrrGrad)" dot={{ r: 4, fill: "#FF6A00", strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Store Table */}
            <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                <h3 className={`${font.sora} font-bold text-lg`}>Minhas Indicações</h3>
                <span className="text-xs font-bold text-neutral-400">{stores.length} total</span>
              </div>
              {stores.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 text-[#FF6A00]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold">Nenhuma loja indicada ainda</p>
                  <p className="text-xs text-neutral-400 mt-1">Compartilhe seu link no WhatsApp para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      <tr>
                        <th className="px-6 py-4">Lojista / Cidade</th>
                        <th className="px-6 py-4">Plano</th>
                        <th className="px-6 py-4">Meta Bônus</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {stores.map((st) => {
                        const bonusPct =
                          st.referral_status === "active" ? 100 :
                          st.referral_status === "churned" ? 100 :
                          25;
                        const bonusColor =
                          st.referral_status === "active" ? "bg-emerald-500" :
                          st.referral_status === "churned" ? "bg-neutral-300" :
                          "bg-[#FF6A00]";
                        const statusMeta = {
                          active: { label: "Gerando MRR", dot: "bg-emerald-500", text: "text-emerald-600" },
                          pending: { label: "Em ativação", dot: "bg-amber-500", text: "text-amber-500" },
                          churned: { label: "Cancelada", dot: "bg-red-500", text: "text-red-600" },
                          blocked: { label: "Bloqueada", dot: "bg-red-500", text: "text-red-600" },
                        }[st.referral_status] || { label: st.referral_status, dot: "bg-neutral-400", text: "text-neutral-500" };

                        return (
                          <tr key={st.store_id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-sm truncate max-w-[220px]">{st.name}</div>
                              <div className="text-xs text-neutral-400 truncate max-w-[220px]">
                                {st.city || "—"} · Gerado: {brl(st.commissions_total_cents)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-bold uppercase whitespace-nowrap">
                                {planLabel(st.plan_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="w-36">
                                <div className="flex justify-between text-[9px] mb-1 font-bold">
                                  <span className="text-neutral-500">
                                    {st.referral_status === "active" ? "Bônus liberado" :
                                     st.referral_status === "churned" ? "—" :
                                     "Aguardando ativação"}
                                  </span>
                                  <span className="text-[#FF6A00]">{brl(r.bounty_amount_cents)}</span>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${bonusColor} transition-all`} style={{ width: `${bonusPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold flex items-center gap-1.5 ${statusMeta.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
                                {statusMeta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Materiais de venda */}
            <div className="bg-white rounded-3xl border border-neutral-200 p-6">
              <h3 className={`${font.sora} font-bold text-lg mb-4 flex items-center gap-2`}>
                <Download className="h-5 w-5 text-[#FF6A00]" /> Materiais de venda
              </h3>
              <a
                href="/materiais/ItaSuper-Ebook-Lojistas-v2.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-100 hover:bg-neutral-50 transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF6A00]">
                  <Download className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">Ebook do Lojista (PDF)</div>
                  <div className="text-xs text-neutral-400">16 páginas — envie no WhatsApp antes de fechar</div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-[#FF6A00] transition" />
              </a>

              <Accordion type="single" collapsible className="w-full mt-3">
                <AccordionItem value="script-frio">
                  <AccordionTrigger className="text-sm">
                    <MessageCircle className="h-4 w-4 mr-2 inline" /> Script de abordagem fria
                  </AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2">
                    <p>Oi [Nome], tudo bem? Vi que você tem [nome da loja] aqui em [cidade].</p>
                    <p>Trabalho com o ItaSuper — um sistema de delivery próprio (site + app) que só cobra taxa quando a loja fatura acima de R$ 2.500/mês. Abaixo disso é 100% gratuito.</p>
                    <p>Faz sentido eu te mandar um resumo de 2 min pra ver se encaixa no seu momento?</p>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText("Oi [Nome], tudo bem? Vi que você tem [nome da loja] aqui em [cidade]. Trabalho com o ItaSuper — um sistema de delivery próprio (site + app) que só cobra taxa quando a loja fatura acima de R$ 2.500/mês. Abaixo disso é 100% gratuito. Faz sentido eu te mandar um resumo de 2 min pra ver se encaixa no seu momento?"); toast.success("Copiado"); }}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="script-followup">
                  <AccordionTrigger className="text-sm">
                    <MessageCircle className="h-4 w-4 mr-2 inline" /> Follow-up (D+2)
                  </AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2">
                    <p>Oi [Nome], só relembrando o material do ItaSuper. Consegui ver o ebook?</p>
                    <p>Se preferir, marco 10 min por vídeo pra te mostrar o painel funcionando com uma loja real.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="objecao">
                  <AccordionTrigger className="text-sm">
                    <MessageCircle className="h-4 w-4 mr-2 inline" /> Objeção "vou pensar"
                  </AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2">
                    <p>Entendo — a maior objeção que a gente ouve é "e se não vender?". Por isso o plano é grátis até faturar R$ 2.500/mês. Você só paga se já estiver ganhando com ele.</p>
                    <p>Posso te deixar cadastrado hoje e você ativa quando quiser?</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

            {/* Referral Link */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
              <h3 className={`${font.sora} font-bold text-lg mb-1 text-[#FF6A00]`}>Seu Link</h3>
              <p className="text-[11px] text-neutral-400 font-medium mb-4">
                Cada loja cadastrada aqui fica vinculada à sua conta pra sempre.
              </p>
              <div className="bg-neutral-50 rounded-2xl p-3 mb-4 border border-neutral-100 truncate font-mono text-[11px] text-neutral-600">
                {referralUrl}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyLink(r.code)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center justify-center transition-all text-neutral-700 font-bold text-xs gap-2"
                >
                  <Copy className="h-4 w-4" /> Copiar
                </button>
                <a
                  href={whatsShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center justify-center transition-all text-emerald-600"
                  title="Compartilhar no WhatsApp"
                >
                  <Send className="h-5 w-5" />
                </a>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(referralUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-orange-50 hover:bg-orange-100 rounded-xl flex items-center justify-center transition-all text-[#FF6A00]"
                  title="Gerar QR Code"
                >
                  <QrCode className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Funnel */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
              <h3 className={`${font.sora} font-bold text-lg mb-6`}>Funil de Indicações</h3>
              <div className="space-y-4">
                {(() => {
                  const total = s.total_referrals || 0;
                  const active = s.active_referrals || 0;
                  const generating = stores.filter(x => x.commissions_total_cents > 0).length;
                  const pct = (n: number) => total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0;
                  const rows = [
                    { label: "Cadastradas", value: total, pct: 100, bg: "bg-neutral-200/50", text: "text-neutral-600" },
                    { label: "Ativas", value: active, pct: pct(active), bg: "bg-orange-100/50", text: "text-neutral-600" },
                    { label: "Faturando", value: generating, pct: pct(generating), bg: "bg-[#FF6A00]/10", text: "text-[#FF6A00]", highlight: true },
                  ];
                  return rows.map((row) => (
                    <div
                      key={row.label}
                      className={`relative flex items-center justify-between p-3 bg-neutral-50 rounded-2xl overflow-hidden ${row.highlight ? "border border-orange-100" : ""}`}
                    >
                      <div className="z-10 text-xs font-bold uppercase tracking-wider text-neutral-500">{row.label}</div>
                      <div className={`z-10 ${font.sora} font-bold ${row.text}`}>{row.value}</div>
                      <div
                        className={`absolute left-0 top-0 h-full ${row.bg} transition-all`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Recent history */}
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 flex-1">
              <h3 className={`${font.sora} font-bold text-lg mb-4`}>Histórico Recente</h3>

              {commissions.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">Nenhuma comissão ainda.</p>
              ) : (
                <div className="space-y-4">
                  {commissions.slice(0, 4).map((c) => {
                    const isBonus = c.kind === "bounty" || c.kind === "bonus";
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isBonus ? "bg-orange-50 text-[#FF6A00]" : "bg-neutral-50 text-neutral-400"
                        }`}>
                          {isBonus ? <Gift className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {isBonus ? "Bônus de Ativação" : "Comissão MRR"}
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight">
                            {c.reference_month || new Date(c.created_at).toLocaleDateString("pt-BR")} · {c.status}
                          </p>
                        </div>
                        <span className={`font-bold text-sm ${isBonus ? "text-[#FF6A00]" : "text-neutral-700"}`}>
                          +{brl(c.amount_cents)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 mt-4 border-t border-neutral-100">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Últimos Saques</p>
                  <Dialog open={pOpen} onOpenChange={(o) => { setPOpen(o); if (o) { setPPix(r.pix_key || ""); setPType((r.pix_key_type as any) || "cpf"); } }}>
                    <DialogTrigger asChild>
                      <button className="text-[10px] font-bold text-[#FF6A00] hover:underline">
                        Alterar PIX
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Alterar chave PIX</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Tipo</Label>
                          <select value={pType} onChange={e => setPType(e.target.value as any)}
                            className="w-full h-10 rounded-md border border-input bg-background px-3">
                            <option value="cpf">CPF</option>
                            <option value="cnpj">CNPJ</option>
                            <option value="email">E-mail</option>
                            <option value="telefone">Telefone</option>
                            <option value="aleatoria">Aleatória</option>
                          </select>
                        </div>
                        <div>
                          <Label>Chave</Label>
                          <Input value={pPix} onChange={e => setPPix(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPOpen(false)}>Cancelar</Button>
                        <Button onClick={savePix} disabled={pLoading} className="bg-[#FF6A00] hover:bg-[#E65F00]">
                          {pLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-2">Nenhum saque solicitado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {withdrawals.slice(0, 4).map((w) => (
                      <div key={w.id} className="flex justify-between items-center text-xs font-semibold bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-neutral-500">
                          {new Date(w.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            w.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                            w.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>{w.status}</span>
                          <span className="text-neutral-700">{brl(w.amount_cents)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-neutral-400 mt-3 text-center">
                  Pagamentos via PIX na chave cadastrada.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}