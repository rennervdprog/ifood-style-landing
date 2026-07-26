import { useState } from "react";
import PartnerSettlement from "@/components/PartnerSettlement";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Users, Percent, PiggyBank, DollarSign, Send, Plus, Trash2, Edit2, Check, X, Wallet, TrendingUp, Shield, Calendar, ArrowRight, CreditCard, BarChart3, Building2
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { planLabel } from "@/lib/plansInfo";

interface Partner {
  id: string;
  name: string;
  email: string | null;
  profit_percent: number;
  emergency_fund_percent: number;
  pix_key: string | null;
  pix_type: string;
  is_owner: boolean;
  is_active: boolean;
  auto_transfer: boolean;
}

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

// --- Sub-components ---

const PartnerForm = ({ form, setForm, onSave, onCancel, isPending, isNew, partnerId }: any) => (
  <Card className="border-2 border-primary/20">
    <CardContent className="pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nome</Label>
          <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Nome do sócio" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
        </div>
        <div>
          <Label>% do Lucro</Label>
          <Input type="number" min={0} max={100} value={form.profit_percent} onChange={e => setForm((f: any) => ({ ...f, profit_percent: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>% Fundo de Emergência (da sua parte)</Label>
          <Input type="number" min={0} max={50} value={form.emergency_fund_percent} onChange={e => setForm((f: any) => ({ ...f, emergency_fund_percent: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Tipo de Chave PIX</Label>
          <Select value={form.pix_type} onValueChange={(v: string) => setForm((f: any) => ({ ...f, pix_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PIX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Chave PIX</Label>
          <Input value={form.pix_key} onChange={e => setForm((f: any) => ({ ...f, pix_key: e.target.value }))} placeholder="Chave PIX para recebimento" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_owner} onCheckedChange={(v: boolean) => setForm((f: any) => ({ ...f, is_owner: v }))} />
          <Label>É o dono (você)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.auto_transfer} onCheckedChange={(v: boolean) => setForm((f: any) => ({ ...f, auto_transfer: v }))} />
          <Label>Transferência automática</Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(isNew ? form : { ...form, id: partnerId })} disabled={isPending || !form.name || form.profit_percent <= 0}>
          <Check className="w-4 h-4 mr-1" /> Salvar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
      </div>
    </CardContent>
  </Card>
);

const RevenueBreakdownCard = ({ planBreakdown, pendingCommission, pendingRepasse, partners }: {
  planBreakdown: { plan_type: string; qty: number; total_fee: number; avg_commission: number }[];
  pendingCommission: number;
  pendingRepasse: number;
  partners: Partner[];
}) => {
  const totalMonthlyFees = planBreakdown.reduce((s, p) => s + Number(p.total_fee), 0);
  const totalRecurring = totalMonthlyFees;
  const totalPendingReceivables = pendingCommission + pendingRepasse;
  const totalRevenue = totalRecurring + totalPendingReceivables;

  // labels vêm do helper central `planLabel` para manter uma única fonte de verdade

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Receita Detalhada da Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assinaturas */}
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-blue-500" /> Assinaturas Ativas
          </h4>
          <div className="space-y-1">
            {planBreakdown.map(p => (
              <div key={p.plan_type} className="flex justify-between text-sm bg-muted/50 rounded px-3 py-2">
                <span>
                  <Badge variant="outline" className="mr-2 text-xs">{p.qty}</Badge>
                  {planLabel(p.plan_type)}
                  {Number(p.avg_commission) > 0 && (
                    <span className="text-muted-foreground ml-1">(+{Number(p.avg_commission).toFixed(1)}% comissão)</span>
                  )}
                </span>
                <span className="font-medium">{formatBRL(p.total_fee)}/mês</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold mt-2 px-3">
            <span>Total Assinaturas</span>
            <span className="text-blue-600">{formatBRL(totalMonthlyFees)}/mês</span>
          </div>
        </div>

        <Separator />

        {/* Comissões a Receber */}
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" /> Comissões & Repasses Pendentes
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between text-sm bg-muted/50 rounded px-3 py-2">
              <span>Comissões pendentes</span>
              <span className="font-medium">{formatBRL(pendingCommission)}</span>
            </div>
            <div className="flex justify-between text-sm bg-muted/50 rounded px-3 py-2">
              <span>Repasses pendentes (entrega própria)</span>
              <span className="font-medium">{formatBRL(pendingRepasse)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm font-semibold mt-2 px-3">
            <span>Total a Receber</span>
            <span className="text-green-600">{formatBRL(totalPendingReceivables)}</span>
          </div>
        </div>

        <Separator />

        {/* Divisão por Sócio */}
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-500" /> Divisão por Sócio (Receita Mensal Estimada)
          </h4>
          <div className="space-y-2">
            {partners.filter(p => p.is_active).map(p => {
              const grossMonthly = totalRecurring * (p.profit_percent / 100);
              const grossPending = totalPendingReceivables * (p.profit_percent / 100);
              const emergencyMonthly = grossMonthly * (p.emergency_fund_percent / 100);
              const emergencyPending = grossPending * (p.emergency_fund_percent / 100);
              const netMonthly = grossMonthly - emergencyMonthly;
              const netPending = grossPending - emergencyPending;

              return (
                <div key={p.id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{p.name}</span>
                    {p.is_owner && <Badge variant="secondary" className="text-xs">Dono</Badge>}
                    <Badge className="text-xs">{p.profit_percent}%</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground">Assinaturas/mês</p>
                      <p className="font-semibold text-blue-600">{formatBRL(grossMonthly)}</p>
                      <p className="text-muted-foreground">- Fundo: {formatBRL(emergencyMonthly)}</p>
                      <p className="font-bold text-green-600">Líq: {formatBRL(netMonthly)}</p>
                    </div>
                    <div className="bg-background rounded p-2">
                      <p className="text-muted-foreground">Pendente a receber</p>
                      <p className="font-semibold text-green-600">{formatBRL(grossPending)}</p>
                      <p className="text-muted-foreground">- Fundo: {formatBRL(emergencyPending)}</p>
                      <p className="font-bold text-green-600">Líq: {formatBRL(netPending)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PartnerSplitPanel = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", profit_percent: 0, emergency_fund_percent: 5,
    pix_key: "", pix_type: "cpf", is_owner: false, auto_transfer: true,
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["platform-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_partners")
        .select("*")
        .order("is_owner", { ascending: false });
      if (error) throw error;
      return data as Partner[];
    },
  });

  const { data: fundBalance = 0 } = useQuery({
    queryKey: ["emergency-fund-balance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_fund")
        .select("amount, transaction_type");
      if (error) throw error;
      return (data || []).reduce((acc, t) =>
        t.transaction_type === "deposit" ? acc + Number(t.amount) : acc - Number(t.amount), 0
      );
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["partner-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_payouts")
        .select("*, platform_partners(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Plan breakdown by type
  const { data: planBreakdown = [] } = useQuery({
    queryKey: ["plan-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("plan_type, monthly_fee, commission_rate")
        .eq("is_active", true);
      if (error) throw error;
      const grouped: Record<string, { plan_type: string; qty: number; total_fee: number; avg_commission: number; commissions: number[] }> = {};
      (data || []).forEach(p => {
        if (!grouped[p.plan_type]) grouped[p.plan_type] = { plan_type: p.plan_type, qty: 0, total_fee: 0, avg_commission: 0, commissions: [] };
        grouped[p.plan_type].qty++;
        grouped[p.plan_type].total_fee += Number(p.monthly_fee);
        grouped[p.plan_type].commissions.push(Number(p.commission_rate));
      });
      return Object.values(grouped).map(g => ({
        ...g,
        avg_commission: g.commissions.length ? g.commissions.reduce((a, b) => a + b, 0) / g.commissions.length : 0,
      }));
    },
  });

  // Pending balances
  const { data: pendingBalances = { commission: 0, repasse: 0 } } = useQuery({
    queryKey: ["pending-balances-total"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_balances").select("comissao_pendente, repasse_pendente");
      if (error) throw error;
      return {
        commission: (data || []).reduce((s, b) => s + Number(b.comissao_pendente || 0), 0),
        repasse: (data || []).reduce((s, b) => s + Number(b.repasse_pendente || 0), 0),
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (partner: Partial<Partner> & { id?: string }) => {
      if (partner.id) {
        const { error } = await supabase.from("platform_partners").update(partner).eq("id", partner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("platform_partners").insert(partner as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partners"] });
      toast.success("Sócio salvo com sucesso!");
      setEditing(null);
      setAdding(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("platform_partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-partners"] });
      toast.success("Sócio removido.");
    },
  });

  const resetForm = () => setForm({
    name: "", email: "", profit_percent: 0, emergency_fund_percent: 5,
    pix_key: "", pix_type: "cpf", is_owner: false, auto_transfer: true,
  });

  const startEdit = (p: Partner) => {
    setEditing(p.id);
    setForm({
      name: p.name, email: p.email || "", profit_percent: p.profit_percent,
      emergency_fund_percent: p.emergency_fund_percent, pix_key: p.pix_key || "",
      pix_type: p.pix_type, is_owner: p.is_owner, auto_transfer: p.auto_transfer,
    });
  };

  const totalPercent = partners.reduce((s, p) => s + Number(p.profit_percent), 0);
  const totalPlans = planBreakdown.reduce((s, p) => s + p.qty, 0);
  const totalMonthly = planBreakdown.reduce((s, p) => s + p.total_fee, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Building2 className="w-6 h-6 mx-auto text-blue-500 mb-1" />
            <p className="text-xs text-muted-foreground">Lojas Ativas</p>
            <p className="text-lg font-bold">{totalPlans}</p>
            <p className="text-xs text-muted-foreground">{formatBRL(totalMonthly)}/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-1" />
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="text-lg font-bold">{formatBRL(pendingBalances.commission + pendingBalances.repasse)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <PiggyBank className="w-6 h-6 mx-auto text-amber-500 mb-1" />
            <p className="text-xs text-muted-foreground">Fundo Emergência</p>
            <p className="text-lg font-bold">{formatBRL(fundBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xs text-muted-foreground">Sócios Ativos</p>
            <p className="text-lg font-bold">{partners.filter(p => p.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Repasses dias 5 e 20</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown with per-partner split */}
      <RevenueBreakdownCard
        planBreakdown={planBreakdown}
        pendingCommission={pendingBalances.commission}
        pendingRepasse={pendingBalances.repasse}
        partners={partners}
      />

      {/* Settlement / Fechamento */}
      {partners.length >= 2 && <PartnerSettlement partners={partners} />}

      {/* Partners List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5" /> Sócios da Plataforma
          </CardTitle>
          {!adding && (
            <Button size="sm" onClick={() => { setAdding(true); resetForm(); }}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Sócio
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {totalPercent !== 100 && partners.length > 0 && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
              <Shield className="w-4 h-4" />
              A soma das porcentagens é {totalPercent}%. Deve ser 100%.
            </div>
          )}

          {adding && (
            <PartnerForm
              form={form} setForm={setForm}
              onSave={(data: any) => saveMutation.mutate(data)}
              onCancel={() => { setAdding(false); resetForm(); }}
              isPending={saveMutation.isPending}
              isNew={true}
            />
          )}

          {partners.map(p => (
            <div key={p.id}>
              {editing === p.id ? (
                <PartnerForm
                  form={form} setForm={setForm}
                  onSave={(data: any) => saveMutation.mutate(data)}
                  onCancel={() => { setEditing(null); resetForm(); }}
                  isPending={saveMutation.isPending}
                  isNew={false} partnerId={p.id}
                />
              ) : (
                <Card className={`${p.is_owner ? 'border-primary/40' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.is_owner ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {p.is_owner ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {p.is_owner && <Badge variant="secondary" className="text-xs">Dono</Badge>}
                            <Badge className="text-xs">{p.profit_percent}%</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {p.pix_key ? `PIX: ${p.pix_key.substring(0, 6)}...` : "Sem PIX configurado"}
                            {" · "}Fundo: {p.emergency_fund_percent}%
                            {p.auto_transfer ? " · Auto ✅" : " · Manual"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {!p.is_owner && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                            if (confirm("Remover este sócio?")) deleteMutation.mutate(p.id);
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}

          {partners.length === 0 && !adding && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum sócio cadastrado. Adicione você e seu sócio.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Histórico de Repasses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum repasse realizado ainda.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div>
                    <span className="font-medium">{p.platform_partners?.name || "Sócio"}</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      {p.period_start && ` · ${p.period_start} a ${p.period_end}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatBRL(p.net_amount)}</p>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                      {p.status === "paid" ? "Pago" : p.status === "failed" ? "Falhou" : p.status === "processing" ? "Processando" : "Pendente"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Fund */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="w-5 h-5" /> Fundo de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Saldo atual: <span className="font-bold text-lg">{formatBRL(fundBalance)}</span>
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Os depósitos são feitos automaticamente a cada repasse nos dias 5 e 20.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerSplitPanel;
