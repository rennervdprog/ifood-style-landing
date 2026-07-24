import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, User, Copy, Wallet, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";
import { useResellerDashboard, brl } from "./useResellerDashboard";
import { APP_VERSION } from "@/lib/appVersion";

export default function ResellerPerfil() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useResellerDashboard();

  const [pOpen, setPOpen] = useState(false);
  const [pPix, setPPix] = useState("");
  const [pType, setPType] = useState<"cpf" | "cnpj" | "email" | "telefone" | "aleatoria">("cpf");
  const [pLoading, setPLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const r = data?.reseller;
  const s = data?.stats;
  const withdrawals = data?.withdrawals || [];
  if (!r || !s) return null;

  const link = `${window.location.origin}/cadastro-lojista?ref=${r.code}`;
  const available = s.balance_pending_cents + s.balance_paid_cents - s.withdrawn_cents - s.pending_withdrawal_cents;

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
    qc.invalidateQueries({ queryKey: ["reseller-dashboard"] });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black tracking-tight">Perfil do Revendedor</h1>
            <p className="text-[10px] text-muted-foreground">Código {r.code}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 max-w-md mx-auto">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate">{user?.email}</div>
              <div className="text-[11px] text-muted-foreground">
                Status:{" "}
                <span className={
                  r.status === "approved" ? "text-green-600 font-semibold" :
                  r.status === "pending" ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"
                }>{r.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Disponível</span>
              <span className="font-bold text-amber-600">{brl(Math.max(0, available))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total recebido</span>
              <span className="font-bold text-green-600">{brl(s.withdrawn_cents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Este mês</span>
              <span className="font-bold">{brl(s.earnings_this_month_cents)}</span>
            </div>
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => navigate("/revendedor")}>
              Solicitar saque
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Chave PIX (recebimento)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm font-mono">
              {r.pix_key || <span className="text-muted-foreground italic">Nenhuma cadastrada</span>}
              {r.pix_key_type && <span className="text-xs text-muted-foreground ml-1">({r.pix_key_type})</span>}
            </div>
            <Dialog open={pOpen} onOpenChange={(o) => {
              setPOpen(o);
              if (o) { setPPix(r.pix_key || ""); setPType((r.pix_key_type as any) || "cpf"); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="w-full">Alterar chave PIX</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Alterar chave PIX</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Tipo</Label>
                    <select value={pType} onChange={(e) => setPType(e.target.value as any)}
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
                    <Input value={pPix} onChange={(e) => setPPix(e.target.value)} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Link de indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-[11px] font-mono break-all">{link}</div>
            <Button size="sm" variant="outline" className="w-full" onClick={copyLink}>
              <Copy className="h-3 w-3 mr-1" /> Copiar link
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Últimos saques</CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum saque ainda.</p>
            ) : (
              <div className="space-y-1">
                {withdrawals.slice(0, 6).map((w) => (
                  <div key={w.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        w.status === "paid" ? "bg-green-500/10 text-green-600" :
                        w.status === "rejected" ? "bg-red-500/10 text-red-600" :
                        "bg-amber-500/10 text-amber-600"
                      }`}>{w.status}</span>
                      <span className="font-semibold text-xs">{brl(w.amount_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate("/revendedor")}>
          Abrir painel completo
        </Button>

        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair da conta
        </Button>

        <p className="text-center text-[10px] text-muted-foreground/50 pt-2">ItaSuper v{APP_VERSION}</p>
      </main>

      <BottomNav />
    </div>
  );
}