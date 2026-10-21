import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, ChevronRight, CreditCard, Loader2, LogOut, Pencil, Shield, Unlock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { usePdvOperator } from "@/hooks/usePdvOperator";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";
import SignOutConfirm from "@/components/SignOutConfirm";
import { supabase } from "@/integrations/supabase/client";

interface PdvOperatorListItem {
  id: string;
  name: string;
  active: boolean;
  role?: string;
}

interface Props {
  storeName?: string;
  storeId?: string;
  openingAmount: string;
  setOpeningAmount: (v: string) => void;
  onOpen: () => void;
  loading: boolean;
  /** Se fornecido, exibe botão secundário "Ver relatórios" abaixo do card. */
  onViewReports?: () => void;
  /** Se fornecido, exibe botão "Meu Plano" (usado por lojas PDV Only). */
  onViewPlan?: () => void;
  /** Se true, exibe botão "Sair da conta" no fim da tela (lojas PDV Only). */
  showSignOut?: boolean;
  /** Se true (lojas PDV Only), esconde o botão "voltar" — o painel /admin
   *  (delivery) não é acessível para essas lojas, o botão não leva a nada. */
  isPdvOnly?: boolean;
}

const CHANGE_CHIPS = [
  { label: "R$ 50", value: 50 },
  { label: "R$ 100", value: 100 },
  { label: "R$ 200", value: 200 },
];

export const PdvAberturaScreen = ({ storeName, storeId, openingAmount, setOpeningAmount, onOpen, loading, onViewReports, onViewPlan, showSignOut, isPdvOnly }: Props) => {
  const navigate = useNavigate();
  const { operator, setOperator } = usePdvOperator(storeId);
  const [pinOpen, setPinOpen] = useState(false);
  const [operators, setOperators] = useState<PdvOperatorListItem[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  // Tutorial de primeiro acesso só aparece enquanto não existir gerente cadastrado.
  const [hasManager, setHasManager] = useState<boolean | null>(null);
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoadingOperators(true);
    (async () => {
      const { data, error } = await supabase.rpc("pdv_list_operators" as any, { _store_id: storeId } as any);
      if (cancelled) return;
      if (error) { setHasManager(true); setLoadingOperators(false); return; } // fail-closed: não mostra tutorial em caso de erro
      const list = ((((data as any[]) || []).filter((o: any) => o.active)) as PdvOperatorListItem[]);
      setOperators(list);
      setHasManager(list.some((o) => o.active && o.role === "gerente"));
      setLoadingOperators(false);
    })();
    return () => { cancelled = true; };
  }, [storeId, pinOpen]);

  // Edição rápida de nome/cargo direto na lista inicial (mesma RPC da aba Operadores).
  const [editingOp, setEditingOp] = useState<PdvOperatorListItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"gerente" | "operador">("operador");
  const [savingEdit, setSavingEdit] = useState(false);

  const reloadOperators = async () => {
    if (!storeId) return;
    const { data, error } = await supabase.rpc("pdv_list_operators" as any, { _store_id: storeId } as any);
    if (error) return;
    const list = ((((data as any[]) || []).filter((o: any) => o.active)) as PdvOperatorListItem[]);
    setOperators(list);
    setHasManager(list.some((o) => o.active && o.role === "gerente"));
  };

  const saveEdit = async () => {
    if (!editingOp || !storeId) return;
    if (editName.trim().length < 2) { toast.error("Nome muito curto"); return; }
    setSavingEdit(true);
    try {
      const { error } = await supabase.rpc("pdv_upsert_operator" as any, {
        _store_id: storeId, _id: editingOp.id, _name: editName.trim(), _pin: null, _role: editRole,
      } as any);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("last_manager")) toast.error("Não pode remover o último gerente");
        else toast.error(msg || "Erro ao salvar");
        return;
      }
      toast.success("Operador atualizado");
      if (operator?.id === editingOp.id) setOperator({ ...operator, name: editName.trim() });
      setEditingOp(null);
      await reloadOperators();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSavingEdit(false); }
  };

  const storeLabel = storeName || "";

  return (
    <div className="pdv-shell min-h-dvh bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-4 gap-2 bg-card shrink-0">
        {!isPdvOnly && (
          <button
            onClick={() => navigate("/admin")}
            aria-label="Voltar"
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <p className="text-[16px] font-bold text-foreground flex-1 truncate">{storeLabel || "Abrir o caixa"}</p>
        <span className="text-xs font-bold text-muted-foreground">passo 1 de 2</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <form
          className="w-full max-w-md mx-auto px-4 pt-6 pb-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!operator) { setPinOpen(true); return; }
            if (!loading) onOpen();
          }}
        >
          <div>
            <h1 className="text-[19px] font-extrabold text-foreground">Quem está no caixa?</h1>
            <p className="text-sm text-muted-foreground mt-1">Toque no seu nome e digite seu PIN.</p>
          </div>

          {storeId && (
            <div className="space-y-2">
              {loadingOperators && operators.length === 0
                ? [0, 1].map((i) => (
                    <div
                      key={i}
                      className="w-full min-h-[64px] rounded-2xl border border-border bg-card p-3 flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-muted w-2/3" />
                        <div className="h-3 rounded bg-muted w-1/3" />
                      </div>
                    </div>
                  ))
                : operators.map((op) => {
                    const selected = operator?.id === op.id;
                    return (
                      <div
                        key={op.id}
                        className={`w-full min-h-[64px] rounded-2xl flex items-stretch transition-all ${
                          selected
                            ? "border-2 border-primary bg-primary/10"
                            : "border-2 border-border bg-card hover:bg-muted/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setPinOpen(true)}
                          className="flex-1 min-w-0 p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                        >
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "linear-gradient(135deg,#FF6A00,#FF9A3D)" }}
                          >
                            <span className="text-white text-lg font-extrabold">
                              {op.name.trim().charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-foreground truncate">{op.name}</p>
                            <p className="text-xs text-muted-foreground">{op.role === "gerente" ? "gerente" : "operador"}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Editar nome de ${op.name}`}
                          title="Editar nome"
                          onClick={() => {
                            setEditingOp(op);
                            setEditName(op.name);
                            setEditRole(op.role === "gerente" ? "gerente" : "operador");
                          }}
                          className="px-3 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
            </div>
          )}

          {storeId && !operator && hasManager === false && (
            <button
              type="button"
              onClick={() => setPinOpen(true)}
              className="w-full min-h-[48px] text-left rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 hover:bg-primary/10 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[11px] font-black uppercase tracking-wider text-primary">Primeiro acesso? Comece aqui</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Cadastre um <b>gerente</b> antes de tudo. Ele autoriza sangrias e libera o cadastro dos operadores do caixa.
                </p>
              </div>
            </button>
          )}

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground">
                Fundo de troco
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">R$</span>
                <input
                  type="text" inputMode="decimal"
                  value={openingAmount}
                  onChange={e => {
                    const n = parseBRLCentsInput(e.target.value);
                    setOpeningAmount(n > 0 ? formatBRLDisplay(n) : "");
                  }}
                  placeholder="0,00"
                  aria-label="Fundo de troco"
                  className="w-full pl-10 pr-4 py-4 bg-muted/40 rounded-xl text-[22px] font-extrabold text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex gap-2 justify-center">
                {CHANGE_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setOpeningAmount(formatBRLDisplay(chip.value))}
                    className="h-12 px-5 rounded-full border border-border bg-muted/40 text-sm font-bold text-foreground hover:border-primary/50 active:scale-95 transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Deixe 0,00 se não tiver troco inicial</p>
            </div>
          </div>

          <button
            type={operator ? "submit" : "button"}
            disabled={loading}
            onClick={operator ? undefined : (e) => { e.preventDefault(); setPinOpen(true); }}
            className="w-full h-14 bg-primary text-primary-foreground font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
            {operator ? "Abrir caixa" : "Selecione o operador"}
          </button>

          {onViewReports && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button
                type="button"
                onClick={onViewReports}
                className="w-full h-14 bg-card border border-border hover:border-primary/40 hover:bg-muted/40 text-foreground font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
              >
                <BarChart3 className="h-5 w-5 text-primary" />
                Ver relatórios
              </button>
              <p className="text-[11px] text-center text-muted-foreground -mt-2">
                Consultar vendas anteriores sem abrir o caixa
              </p>
            </>
          )}

          {onViewPlan && (
            <button
              type="button"
              onClick={onViewPlan}
              className="w-full h-14 bg-card border border-border hover:border-primary/40 hover:bg-muted/40 text-foreground font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
            >
              <CreditCard className="h-5 w-5 text-primary" />
              Meu Plano & Mensalidades
            </button>
          )}

          {showSignOut && (
            <SignOutConfirm redirectTo="/portal-parceiro">
              <button
                type="button"
                className="w-full h-14 bg-card border border-border hover:border-destructive/40 hover:bg-destructive/5 text-foreground font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
              >
                <LogOut className="h-5 w-5 text-destructive" />
                Sair da conta
              </button>
            </SignOutConfirm>
          )}
        </form>
      </div>

      {editingOp && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
            <div className="h-12 border-b border-border flex items-center justify-between px-4">
              <p className="text-sm font-black">Editar operador</p>
              <button onClick={() => setEditingOp(null)} className="p-1 rounded hover:bg-muted" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Nome</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Maria"
                  className="w-full px-3 py-3 bg-muted/40 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">Cargo</label>
                <div className="grid grid-cols-2 gap-2">
                  {([["operador", "Operador"], ["gerente", "Gerente"]] as const).map(([r, label]) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditRole(r)}
                      className={`h-11 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-colors ${
                        editRole === r
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {r === "gerente" && <Shield className="h-3.5 w-3.5" />}
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  O PIN não muda aqui — para trocar o PIN, use a aba Operadores.
                </p>
              </div>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {storeId && (
        <PdvOperatorLoginDialog
          open={pinOpen}
          storeId={storeId}
          onClose={() => setPinOpen(false)}
          onLogin={(op) => { setOperator(op); setPinOpen(false); }}
        />
      )}
    </div>
  );
};
