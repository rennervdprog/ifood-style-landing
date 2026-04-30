import { useState, useCallback, useEffect, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet,
  RefreshCw,
  Send,
  KeyRound,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
} from "lucide-react";

interface AsaasPayment {
  id: string;
  value: number;
  netValue?: number;
  description?: string | null;
  billingType?: string;
  status?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  customer?: string;
}

interface AsaasTransfer {
  id: string;
  value: number;
  netValue?: number;
  status?: string;
  type?: string;
  dateCreated?: string;
  scheduleDate?: string | null;
  effectiveDate?: string | null;
  description?: string | null;
}

interface SummaryResponse {
  success: boolean;
  balance: number;
  totalBalance?: number;
  payments: AsaasPayment[];
  transfers: AsaasTransfer[];
  config: {
    pixAddressKey: string | null;
    pixAddressKeyType: string | null;
    autoWithdrawEnabled: boolean;
    minWithdrawAmount: number;
    lastWithdrawAt: string | null;
  };
}

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

function AsaasFinancialPanelInner({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  // Editable PIX form
   const [pixKey, setPixKey] = useState(data?.config.pixAddressKey || "");
   const [pixType, setPixType] = useState<"CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP">(data?.config.pixAddressKeyType as any || "EVP");
   const [autoWithdraw, setAutoWithdraw] = useState(data?.config.autoWithdrawEnabled || false);
   const [minWithdraw, setMinWithdraw] = useState(String(data?.config.minWithdrawAmount || 5));

  const callPanel = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data: res, error } = await supabase.functions.invoke(
        "asaas-financial-panel",
        { body: { store_id: storeId, ...payload } }
      );
      if (error) throw new Error(error.message || "Falha na requisição");
      if (res?.error) throw new Error(res.error);
      return res;
    },
    [storeId]
  );

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await callPanel({ action: "summary" })) as SummaryResponse;
      setData(res);
      if (res.config.pixAddressKey) setPixKey(res.config.pixAddressKey);
      if (res.config.pixAddressKeyType)
        setPixType(res.config.pixAddressKeyType as typeof pixType);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar painel financeiro.");
    } finally {
      setLoading(false);
    }
  }, [callPanel]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleUpdatePix = async () => {
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX.");
      return;
    }
    setActing("pix");
    try {
      await callPanel({
        action: "update-pix",
        pixAddressKey: pixKey.trim(),
        pixAddressKeyType: pixType,
      });
      toast.success("Chave PIX atualizada!");
      await loadSummary();
      toast.success("Chave PIX atualizada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar chave PIX.");
    } finally {
      setActing(null);
    }
  };

  const handleUpdateWithdrawConfig = async () => {
    const val = Number(minWithdraw.replace(",", "."));
    if (isNaN(val) || val < 5) {
      toast.error("Mínimo de saque deve ser R$ 5,00.");
      return;
    }
    setActing("config");
    try {
      await callPanel({
        action: "update-withdraw-config",
        autoWithdrawEnabled: autoWithdraw,
        minWithdrawAmount: val,
      });
      toast.success("Configurações salvas!");
      await loadSummary();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar configurações.");
    } finally {
      setActing(null);
    }
  };

  const handleWithdrawNow = async () => {
    if (!data || data.balance <= 0) {
      toast.error("Sem saldo disponível para saque.");
      return;
    }
    setActing("withdraw");
    try {
      const res = await callPanel({ action: "withdraw-now" });
      toast.success(res?.message || "Saque enviado!");
      await loadSummary();
    } catch (e: any) {
      toast.error(e.message || "Erro ao realizar saque.");
    } finally {
      setActing(null);
    }
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando painel financeiro…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar os dados financeiros.
          <Button variant="outline" size="sm" className="mt-3" onClick={loadSummary}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* SALDO */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Saldo disponível na sua subconta
              </p>
              <p className="text-3xl font-bold mt-1">{fmtMoney(data.balance)}</p>
              {data.config.lastWithdrawAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Último saque: {fmtDate(data.config.lastWithdrawAt)}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadSummary}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <Button
            className="w-full mt-4"
            size="sm"
            onClick={handleWithdrawNow}
            disabled={acting === "withdraw" || data.balance <= 0}
          >
            {acting === "withdraw" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Sacar tudo agora ({fmtMoney(data.balance)})
          </Button>

          {data.config.autoWithdrawEnabled && (
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              ⚡ Saque automático ativo todo dia às 16h (mín. {fmtMoney(data.config.minWithdrawAmount)})
            </p>
          )}
        </CardContent>
      </Card>

      {/* CHAVE PIX */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Chave PIX para receber
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <Label className="text-xs">Tipo de Chave</Label>
              <Select value={pixType} onValueChange={(v) => setPixType(v as typeof pixType)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="PHONE">Celular</SelectItem>
                  <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Sua Chave PIX</Label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Informe sua chave"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleUpdatePix}
            disabled={acting === "pix"}
          >
            {acting === "pix" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salvar Chave PIX
          </Button>
        </CardContent>
      </Card>

      {/* CONFIGURAÇÃO DE SAQUE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Configuração de Saque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Saque automático</Label>
              <p className="text-[11px] text-muted-foreground">O saldo é enviado diariamente às 16h.</p>
            </div>
            <Button
              variant={autoWithdraw ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoWithdraw(!autoWithdraw)}
            >
              {autoWithdraw ? "Ligado" : "Desligado"}
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Valor mínimo para saque (R$)</Label>
            <Input
              value={minWithdraw}
              onChange={(e) => setMinWithdraw(e.target.value)}
              className="h-9"
              type="number"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={handleUpdateWithdrawConfig}
            disabled={acting === "config"}
          >
            {acting === "config" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* ÚLTIMOS RECEBIMENTOS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-green-600" /> Últimos recebimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum recebimento ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.payments.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.description || "Pedido"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtDate(p.paymentDate || p.clientPaymentDate)} • {p.billingType || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      +{fmtMoney(Number(p.netValue ?? p.value))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ÚLTIMOS SAQUES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-orange-600" /> Últimos saques
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.transfers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum saque ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.transfers.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">PIX enviado</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtDate(t.effectiveDate || t.dateCreated || t.scheduleDate)}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-orange-600">
                      −{fmtMoney(Number(t.netValue ?? t.value))}
                    </p>
                    {t.status && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {t.status}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const AsaasFinancialPanel = memo(AsaasFinancialPanelInner);
export default AsaasFinancialPanel;