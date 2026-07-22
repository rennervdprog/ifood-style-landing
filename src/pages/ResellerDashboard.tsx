import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, LogOut, TrendingUp, Users, Wallet, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

type Dashboard = {
  reseller: {
    id: string;
    code: string;
    status: string;
    rate: number;
    bounty_cents: number;
    gmv_bonus_bps: number;
    pix_key: string | null;
    pix_type: string | null;
  } | null;
  totals: {
    active_stores: number;
    total_stores: number;
    lifetime_paid_cents: number;
    pending_cents: number;
  };
  stores: Array<{
    store_id: string;
    name: string;
    status: string;
    plan_type: string;
    linked_at: string;
    gmv_60d_cents: number;
  }>;
  commissions: Array<{
    id: string;
    kind: string;
    amount_cents: number;
    status: string;
    reference_month: string | null;
    created_at: string;
  }>;
  withdrawals: Array<{
    id: string;
    amount_cents: number;
    status: string;
    pix_key: string;
    created_at: string;
    paid_at: string | null;
  }>;
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ResellerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);
  const [needsRegister, setNeedsRegister] = useState(false);
  const [wOpen, setWOpen] = useState(false);
  const [wAmount, setWAmount] = useState("");
  const [wLoading, setWLoading] = useState(false);

  // Registro
  const [rCode, setRCode] = useState("");
  const [rPix, setRPix] = useState("");
  const [rType, setRType] = useState<"cpf" | "cnpj" | "email" | "telefone" | "aleatoria">("cpf");
  const [rLoading, setRLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) {
      navigate("/auth?next=/revendedor");
      return;
    }
    const { data: dash, error } = await (supabase as any).rpc("reseller_get_dashboard");
    if (error) {
      toast.error("Erro ao carregar painel: " + error.message);
      setLoading(false);
      return;
    }
    if (!dash || !dash.reseller) {
      setNeedsRegister(true);
    } else {
      setData(dash as Dashboard);
      setNeedsRegister(false);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!rPix.trim()) return toast.error("Informe sua chave PIX");
    setRLoading(true);
    const { data: res, error } = await (supabase as any).rpc("reseller_register", {
      _code: rCode.trim() || null,
      _pix: rPix.trim(),
      _type: rType,
    });
    setRLoading(false);
    if (error || !res?.success) {
      toast.error(res?.error === "code_taken"
        ? "Este código já está em uso — escolha outro"
        : (error?.message || "Erro ao registrar"));
      return;
    }
    toast.success(`Cadastro enviado! Código: ${res.code}. Aguardando aprovação do super admin.`);
    await load();
  };

  const requestWithdrawal = async () => {
    const cents = Math.round(parseFloat(wAmount.replace(",", ".")) * 100);
    if (!cents || cents < 5000) {
      return toast.error("Valor mínimo de saque: R$ 50,00");
    }
    setWLoading(true);
    const { data: res, error } = await (supabase as any).rpc("reseller_request_withdrawal", {
      _amount_cents: cents,
    });
    setWLoading(false);
    if (error || !res?.success) {
      toast.error(res?.error === "insufficient_balance"
        ? "Saldo insuficiente"
        : (error?.message || "Erro ao solicitar"));
      return;
    }
    toast.success("Saque solicitado! Pagamento em até 3 dias úteis.");
    setWOpen(false);
    setWAmount("");
    load();
  };

  const copyLink = () => {
    if (!data?.reseller?.code) return;
    const url = `${window.location.origin}/cadastro-lojista?ref=${data.reseller.code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsRegister) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Torne-se um revendedor ItaSuper</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ganhe <strong>20% de comissão vitalícia</strong> sobre o MRR de cada loja que você indicar,
                mais <strong>R$ 150 de bônus</strong> por loja ativada (após 20 pedidos entregues).
              </p>
              <div>
                <Label>Seu código (opcional — deixe em branco para gerar automático)</Label>
                <Input value={rCode} onChange={e => setRCode(e.target.value.toUpperCase())}
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
              <Button onClick={handleRegister} disabled={rLoading} className="w-full">
                {rLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar como revendedor
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Sujeito à aprovação do time ItaSuper (até 48h úteis).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data?.reseller) return null;
  const r = data.reseller;
  const isPending = r.status === "pending";
  const isBlocked = r.status === "blocked";

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Painel do Revendedor</h1>
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-semibold">{r.code}</span> · Status:{" "}
              <span className={
                r.status === "active" ? "text-green-600" :
                isPending ? "text-amber-600" : "text-red-600"
              }>{r.status}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {isPending && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-4 text-sm">
              ⏳ Seu cadastro está em análise. Você já pode compartilhar seu link, mas as comissões
              só começam a ser creditadas após aprovação.
            </CardContent>
          </Card>
        )}
        {isBlocked && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="pt-4 text-sm">
              🚫 Sua conta está bloqueada. Entre em contato com o suporte.
            </CardContent>
          </Card>
        )}

        {/* Link de indicação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seu link de indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={`${window.location.origin}/cadastro-lojista?ref=${r.code}`} />
              <Button variant="outline" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Toda loja cadastrada com esse link fica vinculada permanentemente à sua conta.
            </p>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Lojas ativas
              </div>
              <div className="text-2xl font-bold">{data.totals.active_stores}</div>
              <div className="text-[10px] text-muted-foreground">
                de {data.totals.total_stores} indicadas
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Comissão / MRR
              </div>
              <div className="text-2xl font-bold">{(r.rate * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-muted-foreground">vitalícia</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> A receber
              </div>
              <div className="text-2xl font-bold text-amber-600">{brl(data.totals.pending_cents)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Total recebido
              </div>
              <div className="text-2xl font-bold text-green-600">{brl(data.totals.lifetime_paid_cents)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Saque */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitar saque</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Chave PIX cadastrada: <span className="font-mono">{r.pix_key || "—"}</span> ({r.pix_type})
            </p>
            <Dialog open={wOpen} onOpenChange={setWOpen}>
              <DialogTrigger asChild>
                <Button disabled={data.totals.pending_cents < 5000 || isBlocked}>
                  Solicitar saque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Solicitar saque</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm">Disponível: <strong>{brl(data.totals.pending_cents)}</strong></p>
                  <div>
                    <Label>Valor (R$) — mínimo R$ 50,00</Label>
                    <Input value={wAmount} onChange={e => setWAmount(e.target.value)}
                      placeholder="Ex: 250,00" inputMode="decimal" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pagamento em até 3 dias úteis via PIX.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWOpen(false)}>Cancelar</Button>
                  <Button onClick={requestWithdrawal} disabled={wLoading}>
                    {wLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Lojas indicadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lojas indicadas ({data.stores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.stores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma loja indicada ainda. Compartilhe seu link!
              </p>
            ) : (
              <div className="space-y-2">
                {data.stores.map(s => (
                  <div key={s.store_id} className="flex justify-between items-center p-2 rounded border">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.plan_type} · GMV 60d: {brl(s.gmv_60d_cents)}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === "active" ? "bg-green-500/10 text-green-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extrato */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas comissões</CardTitle>
          </CardHeader>
          <CardContent>
            {data.commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma comissão registrada ainda.
              </p>
            ) : (
              <div className="space-y-1">
                {data.commissions.slice(0, 20).map(c => (
                  <div key={c.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="capitalize">{c.kind}</span>
                      {c.reference_month && <span className="text-xs text-muted-foreground ml-1">({c.reference_month})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        c.status === "paid" ? "bg-green-500/10 text-green-600" :
                        c.status === "approved" ? "bg-blue-500/10 text-blue-600" :
                        "bg-amber-500/10 text-amber-600"
                      }`}>{c.status}</span>
                      <span className="font-semibold">{brl(c.amount_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}