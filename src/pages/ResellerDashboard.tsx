import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, LogOut, TrendingUp, Users, Wallet, Loader2, Download, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

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

export default function ResellerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);

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
      navigate("/auth?next=/revendedor");
      return;
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Ainda não registrado
  if (!data?.registered) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Torne-se um revendedor ItaSuper</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

  const r = data.reseller!;
  const s = data.stats!;
  const stores = data.stores || [];
  const commissions = data.commissions || [];
  const withdrawals = data.withdrawals || [];
  const isPending = r.status === "pending";
  const isBlocked = r.status === "blocked";
  const available = s.balance_pending_cents + s.balance_paid_cents - s.withdrawn_cents - s.pending_withdrawal_cents;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Painel do Revendedor</h1>
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-semibold">{r.code}</span> · Status:{" "}
              <span className={
                r.status === "approved" ? "text-green-600" :
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
              ⏳ Seu cadastro está em análise. Você já pode compartilhar seu link, mas comissões
              só passam a ser creditadas após aprovação.
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seu link de indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={`${window.location.origin}/cadastro-lojista?ref=${r.code}`} />
              <Button variant="outline" onClick={() => copyLink(r.code)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Toda loja cadastrada com esse link fica vinculada permanentemente à sua conta.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Lojas ativas
              </div>
              <div className="text-2xl font-bold">{s.active_referrals}</div>
              <div className="text-[10px] text-muted-foreground">de {s.total_referrals} indicadas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Comissão / MRR
              </div>
              <div className="text-2xl font-bold">{(r.commission_rate * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-muted-foreground">vitalícia</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Saldo disponível
              </div>
              <div className="text-2xl font-bold text-amber-600">{brl(Math.max(0, available))}</div>
              <div className="text-[10px] text-muted-foreground">
                Este mês: {brl(s.earnings_this_month_cents)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Total recebido
              </div>
              <div className="text-2xl font-bold text-green-600">{brl(s.withdrawn_cents)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitar saque</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Chave PIX: <span className="font-mono">{r.pix_key || "—"}</span>
              {r.pix_key_type && ` (${r.pix_key_type})`}
            </p>
            <Dialog open={wOpen} onOpenChange={setWOpen}>
              <DialogTrigger asChild>
                <Button disabled={available < 5000 || isBlocked || isPending}>
                  Solicitar saque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Solicitar saque</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm">Disponível: <strong>{brl(Math.max(0, available))}</strong></p>
                  <div>
                    <Label>Valor (R$) — mínimo R$ 50,00</Label>
                    <Input value={wAmount} onChange={e => setWAmount(e.target.value)}
                      placeholder="Ex: 250,00" inputMode="decimal" />
                  </div>
                  <p className="text-xs text-muted-foreground">Pagamento em até 3 dias úteis via PIX.</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lojas indicadas ({stores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {stores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma loja indicada ainda. Compartilhe seu link!
              </p>
            ) : (
              <div className="space-y-2">
                {stores.map(st => (
                  <div key={st.store_id} className="flex justify-between items-center p-2 rounded border">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{st.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {st.plan_type || "—"} · GMV 60d: {brl(st.gmv_60d_cents)} · Total gerado: {brl(st.commissions_total_cents)}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      st.referral_status === "active" ? "bg-green-500/10 text-green-600" :
                      st.referral_status === "churned" ? "bg-red-500/10 text-red-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{st.referral_status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas comissões</CardTitle>
            </CardHeader>
            <CardContent>
              {commissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma comissão ainda.
                </p>
              ) : (
                <div className="space-y-1">
                  {commissions.slice(0, 20).map(c => (
                    <div key={c.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="capitalize">{c.kind}</span>
                        {c.reference_month && <span className="text-xs text-muted-foreground ml-1">({c.reference_month})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          c.status === "paid" ? "bg-green-500/10 text-green-600" :
                          c.status === "cancelled" ? "bg-red-500/10 text-red-600" :
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saques</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum saque solicitado.
                </p>
              ) : (
                <div className="space-y-1">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          w.status === "paid" ? "bg-green-500/10 text-green-600" :
                          w.status === "rejected" ? "bg-red-500/10 text-red-600" :
                          "bg-amber-500/10 text-amber-600"
                        }`}>{w.status}</span>
                        <span className="font-semibold">{brl(w.amount_cents)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Materiais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> Materiais de venda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/materiais/ItaSuper-Ebook-Lojistas-v2.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded border hover:bg-accent transition"
            >
              <Download className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">Ebook do Lojista (PDF)</div>
                <div className="text-xs text-muted-foreground">16 páginas — envie no WhatsApp antes de fechar</div>
              </div>
            </a>

            <Accordion type="single" collapsible className="w-full">
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

            <p className="text-xs text-muted-foreground">
              Precisa de artes ou vídeos? Fale com o suporte — enviamos pack pronto pra stories/feed.
            </p>
          </CardContent>
        </Card>

        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Chave PIX atual</div>
              <div className="font-mono">{r.pix_key || "—"} {r.pix_key_type && <span className="text-xs text-muted-foreground">({r.pix_key_type})</span>}</div>
            </div>
            <Dialog open={pOpen} onOpenChange={(o) => { setPOpen(o); if (o) { setPPix(r.pix_key || ""); setPType((r.pix_key_type as any) || "cpf"); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Alterar chave PIX</Button>
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
                  <Button onClick={savePix} disabled={pLoading}>
                    {pLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground">
              Pagamentos são feitos manualmente pelo time ItaSuper via PIX na chave cadastrada.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}