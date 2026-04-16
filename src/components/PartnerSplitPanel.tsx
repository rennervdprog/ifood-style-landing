import { useState, useEffect } from "react";
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
  Users, Percent, PiggyBank, DollarSign, Send, Plus, Trash2, Edit2, Check, X, Wallet, TrendingUp, Shield, Calendar, ArrowRight
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

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

  // Platform revenue query (commissions + plan fees from payout_history + store_balances)
  const { data: platformRevenue = 0 } = useQuery({
    queryKey: ["platform-revenue-total"],
    queryFn: async () => {
      const { data: balances } = await supabase.from("store_balances").select("comissao_pendente, repasse_pendente");
      const totalPending = (balances || []).reduce((s, b) => s + Number(b.comissao_pendente || 0) + Number(b.repasse_pendente || 0), 0);
      
      const { data: payoutHist } = await supabase.from("payout_history").select("amount").eq("entity_type", "platform");
      const totalPaid = (payoutHist || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      
      return totalPending + totalPaid;
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
  const totalEmergency = partners.reduce((s, p) => s + (Number(p.profit_percent) * Number(p.emergency_fund_percent) / 100), 0);

  const renderForm = (isNew: boolean, partnerId?: string) => (
    <Card className="border-2 border-primary/20">
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do sócio" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>% do Lucro</Label>
            <Input type="number" min={0} max={100} value={form.profit_percent} onChange={e => setForm(f => ({ ...f, profit_percent: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>% Fundo de Emergência (da sua parte)</Label>
            <Input type="number" min={0} max={50} value={form.emergency_fund_percent} onChange={e => setForm(f => ({ ...f, emergency_fund_percent: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Tipo de Chave PIX</Label>
            <Select value={form.pix_type} onValueChange={v => setForm(f => ({ ...f, pix_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chave PIX</Label>
            <Input value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} placeholder="Chave PIX para recebimento" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_owner} onCheckedChange={v => setForm(f => ({ ...f, is_owner: v }))} />
            <Label>É o dono (você)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.auto_transfer} onCheckedChange={v => setForm(f => ({ ...f, auto_transfer: v }))} />
            <Label>Transferência automática</Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate(isNew ? form : { ...form, id: partnerId })} disabled={saveMutation.isPending || !form.name || form.profit_percent <= 0}>
            <Check className="w-4 h-4 mr-1" /> Salvar
          </Button>
          <Button variant="ghost" onClick={() => { setEditing(null); setAdding(false); resetForm(); }}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Calculate split preview
  const ownerPartner = partners.find(p => p.is_owner);
  const otherPartners = partners.filter(p => !p.is_owner);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-1" />
            <p className="text-xs text-muted-foreground">Receita Plataforma</p>
            <p className="text-lg font-bold">{formatBRL(platformRevenue)}</p>
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
            <Users className="w-6 h-6 mx-auto text-blue-500 mb-1" />
            <p className="text-xs text-muted-foreground">Sócios Ativos</p>
            <p className="text-lg font-bold">{partners.filter(p => p.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Calendar className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xs text-muted-foreground">Repasses</p>
            <p className="text-lg font-bold">Dias 5 e 20</p>
          </CardContent>
        </Card>
      </div>

      {/* Split Preview */}
      {partners.length >= 2 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-5 h-5" /> Simulação de Divisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Para cada <span className="font-bold text-foreground">R$ 1.000</span> de lucro da plataforma:
            </p>
            <div className="space-y-3">
              {partners.map(p => {
                const gross = 1000 * (p.profit_percent / 100);
                const emergency = gross * (p.emergency_fund_percent / 100);
                const net = gross - emergency;
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-background rounded-lg p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.is_owner && <Badge variant="secondary" className="text-xs">Dono</Badge>}
                        <Badge className="text-xs">{p.profit_percent}%</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>Bruto: {formatBRL(gross)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-amber-600">Fundo: {formatBRL(emergency)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-green-600 font-medium">Líquido: {formatBRL(net)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Fundo Emergência:</span>
                <span className="font-bold text-amber-600">{formatBRL(1000 * totalEmergency / 100)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

          {adding && renderForm(true)}

          {partners.map(p => (
            <div key={p.id}>
              {editing === p.id ? renderForm(false, p.id) : (
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

      {/* Emergency Fund History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="w-5 h-5" /> Fundo de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 mb-4">
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
