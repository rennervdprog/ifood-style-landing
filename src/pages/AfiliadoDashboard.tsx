import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AFFILIATE_MIN_PAYOUT } from "@/lib/affiliates";
import {
  buildReferralLink,
  formatBRL,
  formatDateBR,
  nextPayoutDate,
  payoutProgress,
  receivedTotal,
  summarizeCredits,
} from "@/lib/affiliatePanel";
import {
  useAffiliatePanel,
  useUpdateAffiliatePayoutSettings,
  type AffiliateCreditRow,
  type AffiliatePayoutRow,
} from "@/pages/afiliado/useAffiliatePanel";

// Painel do Afiliado — Fase 2 (rota /afiliado).
// Acesso por estado: sem sessão → /auth; sem linha em affiliates →
// convite; pending → em análise; suspended → suspenso; approved → painel.

const CREDIT_STATUS: Record<
  AffiliateCreditRow["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pendente", className: "bg-zinc-600" },
  available: { label: "Liberado", className: "bg-primary" },
  paid: { label: "Pago", className: "bg-green-700" },
  cancelled: { label: "Cancelado", className: "bg-zinc-400" },
};

const PAYOUT_STATUS: Record<
  AffiliatePayoutRow["status"],
  { label: string; className: string }
> = {
  scheduled: { label: "Agendado", className: "bg-zinc-600" },
  paid: { label: "Pago", className: "bg-green-700" },
  failed: { label: "Falhou", className: "bg-red-700" },
  cancelled: { label: "Cancelado", className: "bg-zinc-400" },
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-white ${className}`}
    >
      {label}
    </span>
  );
}

function StateScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            ItaSuper · Afiliados
          </p>
          <h1 className="text-xl font-extrabold">{title}</h1>
          <p className="text-sm text-muted-foreground">{children}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AfiliadoDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const panel = useAffiliatePanel();
  const updateSettings = useUpdateAffiliatePayoutSettings();
  const [pixKey, setPixKey] = useState("");
  const [payoutDay, setPayoutDay] = useState(5);
  const hydratedFor = useRef<string | null>(null);

  const affiliate = panel.data?.affiliate ?? null;

  useEffect(() => {
    if (affiliate && hydratedFor.current !== affiliate.id) {
      hydratedFor.current = affiliate.id;
      setPixKey(affiliate.pix_key ?? "");
      setPayoutDay(affiliate.payout_day);
    }
  }, [affiliate]);

  if (authLoading || (user && panel.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (panel.isError) {
    return (
      <StateScreen title="Algo deu errado">
        Não conseguimos carregar seu painel agora. Tente de novo em alguns
        minutos.
      </StateScreen>
    );
  }

  if (!affiliate) {
    return (
      <StateScreen title="Programa de Afiliados">
        O programa de afiliados do ItaSuper está em piloto fechado, só para
        convidados — e esta conta ainda não é de um afiliado. Se você recebeu
        um convite, entre com a conta do convite. Se quer indicar lojas, fale
        com a gente pelo suporte.
      </StateScreen>
    );
  }

  if (affiliate.status === "pending") {
    return (
      <StateScreen title="Cadastro em análise">
        Recebemos seu cadastro de afiliado. Assim que ele for aprovado, seu
        painel completo aparece aqui — com seu link de indicação e seus
        saldos.
      </StateScreen>
    );
  }

  if (affiliate.status === "suspended") {
    return (
      <StateScreen title="Conta suspensa">
        Seu cadastro de afiliado está suspenso e novas indicações estão
        pausadas. Se você acha que é um engano, fale com o suporte do
        ItaSuper.
      </StateScreen>
    );
  }

  const credits = panel.data?.credits ?? [];
  const referrals = panel.data?.referrals ?? [];
  const payouts = panel.data?.payouts ?? [];
  const summary = summarizeCredits(credits);
  const received = receivedTotal(credits, payouts);
  const progress = payoutProgress(summary.available);
  const nextBatch = nextPayoutDate(affiliate.payout_day);
  const referralLink = buildReferralLink(
    window.location.origin,
    affiliate.referral_code,
  );
  const displayName =
    affiliate.name?.trim() ||
    affiliate.email?.split("@")[0] ||
    "Afiliado";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Link copiado");
    } catch {
      toast.error("Não deu para copiar — selecione o link e copie manualmente.");
    }
  };

  const handleSaveSettings = () => {
    updateSettings.mutate(
      { pixKey: pixKey.trim(), payoutDay },
      {
        onSuccess: () => toast.success("Dados de recebimento salvos"),
        onError: (error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Não deu para salvar agora. Tente de novo.",
          ),
      },
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
              ItaSuper · Afiliados
            </p>
            <h1 className="text-2xl font-extrabold">Olá, {displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe suas indicações e seus recebimentos.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[13px] font-bold text-primary">
              Código <b>{affiliate.referral_code}</b>
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>

        {/* Saldos */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Liberado
              </p>
              <p className="text-[26px] font-extrabold leading-tight text-primary">
                {formatBRL(summary.available)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Disponível para o próximo lote
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pendente
              </p>
              <p className="text-[26px] font-extrabold leading-tight">
                {formatBRL(summary.pending)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {summary.nextReleaseAt
                  ? `Próxima liberação em ${formatDateBR(summary.nextReleaseAt)}`
                  : "Nenhuma liberação prevista"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Já recebido
              </p>
              <p className="text-[26px] font-extrabold leading-tight">
                {formatBRL(received)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Em pagamentos confirmados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Próximo pagamento */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Próximo pagamento</h2>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Seu dia de pagamento é o <b>dia {affiliate.payout_day}</b>. O
              próximo lote cai em <b>{formatDateBR(nextBatch)}</b>.
            </p>
            <Progress value={progress.percent} className="h-2" />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span>
                Você já tem <b>{formatBRL(summary.available)}</b> liberados
              </span>
              {progress.reached ? (
                <span>
                  <b>Mínimo atingido</b> — entra no próximo lote
                </span>
              ) : (
                <span>
                  Faltam <b>{formatBRL(progress.missing)}</b> para o mínimo
                  de {formatBRL(AFFILIATE_MIN_PAYOUT)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Link de indicação */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Seu link de indicação</h2>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Compartilhe este link: a loja que se cadastrar por ele fica
              vinculada a você.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2.5 text-[13px] text-muted-foreground">
                {referralLink}
              </div>
              <Button onClick={handleCopy} className="shrink-0 rounded-full">
                <Copy className="mr-1 h-4 w-4" /> Copiar
              </Button>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-muted-foreground">
              Seu código
            </p>
            <p className="text-xl font-extrabold tracking-wider">
              {affiliate.referral_code}
            </p>
          </CardContent>
        </Card>

        {/* Lojas indicadas */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Lojas indicadas</h2>
            <p className="mb-2 text-[13px] text-muted-foreground">
              {referrals.length === 0
                ? "Nenhuma loja indicada ainda. Compartilhe seu link para começar."
                : referrals.length === 1
                  ? "1 loja vinculada ao seu código."
                  : `${referrals.length} lojas vinculadas ao seu código.`}
            </p>
            {referrals.map((referral) => (
              <div
                key={referral.id}
                className="border-b py-3 last:border-b-0 last:pb-0"
              >
                <p className="text-[15px] font-semibold">
                  {referral.store_name ?? "Loja"}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {referral.plan_label ? `${referral.plan_label} · ` : ""}
                  vinculada em {formatDateBR(referral.created_at)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Extrato */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Extrato</h2>
            <p className="mb-2 text-[13px] text-muted-foreground">
              Suas comissões, mensalidade a mensalidade.
            </p>
            {credits.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhuma comissão ainda — ela nasce quando uma loja indicada
                paga a mensalidade.
              </p>
            )}
            {credits.map((credit) => {
              const status = CREDIT_STATUS[credit.status];
              return (
                <div
                  key={credit.id}
                  className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-[15px] font-semibold">
                      {credit.store_name ?? "Loja"}{" "}
                      <StatusPill {...status} />
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Mensalidade de {formatBRL(Number(credit.base_amount))}{" "}
                      · {credit.rate_percent}%
                      {credit.status === "pending"
                        ? ` · libera em ${formatDateBR(credit.release_at)}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-[15px] font-extrabold">
                    {formatBRL(Number(credit.credit_amount))}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Pagamentos</h2>
            <p className="mb-2 text-[13px] text-muted-foreground">
              Os lotes que o ItaSuper já enviou para você.
            </p>
            {payouts.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                Nenhum pagamento ainda.
              </p>
            )}
            {payouts.map((payout) => {
              const status = PAYOUT_STATUS[payout.status];
              const referenceDate = payout.paid_at ?? payout.scheduled_for;
              const month = referenceDate
                ? new Date(referenceDate).toLocaleDateString("pt-BR", {
                    month: "long",
                  })
                : null;
              return (
                <div
                  key={payout.id}
                  className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-[15px] font-semibold">
                      {month ? `Lote de ${month}` : "Lote de pagamento"}{" "}
                      <StatusPill {...status} />
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {payout.status === "paid" && payout.paid_at
                        ? `Pago em ${formatDateBR(payout.paid_at)} · Pix`
                        : payout.scheduled_for
                          ? `Previsto para ${formatDateBR(payout.scheduled_for)} · Pix`
                          : "Pix"}
                    </p>
                  </div>
                  <p className="text-[15px] font-extrabold">
                    {formatBRL(Number(payout.amount))}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recebimento */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <h2 className="mb-1 text-base font-bold">Recebimento</h2>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Onde e quando você quer receber. O pagamento é feito via Pix,
              no dia escolhido, quando o saldo liberado atinge{" "}
              {formatBRL(AFFILIATE_MIN_PAYOUT)}.
            </p>
            <div className="mb-3 space-y-2">
              <Label htmlFor="affiliate-pix">Sua chave Pix</Label>
              <Input
                id="affiliate-pix"
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                placeholder="e-mail, telefone, CPF ou chave aleatória"
              />
            </div>
            <div className="mb-4 space-y-2">
              <Label>Dia do pagamento</Label>
              <div className="flex gap-2">
                {[5, 20].map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={payoutDay === day ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPayoutDay(day)}
                  >
                    Dia {day}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
              className="rounded-full"
            >
              {updateSettings.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Programa de Afiliados ItaSuper — piloto fechado. Comissão:
          Essencial 100% e Somente PDV 50% da mensalidade paga pela loja,
          enquanto ela permanecer.
        </p>
      </div>
    </div>
  );
}
