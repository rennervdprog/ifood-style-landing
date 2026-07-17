import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, KeyRound, Plus, ArrowLeft, X, Delete, Shield } from "lucide-react";
import type { PdvOperator } from "@/hooks/usePdvOperator";

interface Op { id: string; name: string; active: boolean; role?: string }

interface Props {
  open: boolean;
  storeId: string;
  onClose: () => void;
  onLogin: (op: PdvOperator) => void;
  /**
   * Se definido como 'gerente', a lista só mostra operadores com role='gerente'
   * e a validação usa `pdv_verify_manager_pin` (nega qualquer operador comum).
   * Usado para autorizar sangria acima do limite (Fase 2, item 8).
   */
  requiredRole?: "gerente";
  /** Título alternativo (ex: "Autorização de gerente"). */
  title?: string;
}

/**
 * Dialog de login por PIN do operador do PDV.
 * - Lista operadores ativos; ao selecionar, mostra teclado numérico.
 * - Se não há operadores, permite criar o primeiro inline (dono da loja).
 * - Nunca guarda o PIN em memória além do submit.
 */
export function PdvOperatorLoginDialog({ open, storeId, onClose, onLogin, requiredRole, title }: Props) {
  const [ops, setOps] = useState<Op[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pick" | "pin" | "create">("pick");
  const [selected, setSelected] = useState<Op | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newRole, setNewRole] = useState<"operador" | "gerente">("operador");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("pdv_list_operators" as any, { _store_id: storeId } as any);
      if (error) throw error;
      let list = ((data as any[]) || []).filter((o: any) => o.active) as Op[];
      if (requiredRole) list = list.filter((o) => o.role === requiredRole);
      setOps(list);
      if (list.length === 0) setStep(requiredRole ? "pick" : "create");
      else setStep("pick");
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar operadores");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) { setPin(""); setSelected(null); setNewName(""); setNewPin(""); setNewRole("operador"); load(); }
  }, [open, storeId]);

  if (!open) return null;

  const tryLogin = async () => {
    if (!selected) return;
    if (pin.length < 4) { toast.error("PIN de 4 a 8 dígitos"); return; }
    setBusy(true);
    try {
      const rpc = requiredRole === "gerente" ? "pdv_verify_manager_pin" : "pdv_verify_operator_pin";
      const { data, error } = await supabase.rpc(rpc as any, { _store_id: storeId, _pin: pin } as any);
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) {
        const msg = r?.error === "pin_mismatch" ? "PIN incorreto"
          : r?.error === "not_manager" ? "PIN não pertence a um gerente"
          : "Falha no login";
        toast.error(msg); setPin(""); return;
      }
      onLogin({ id: r.operator_id, name: r.operator_name, loggedAt: Date.now() });
    } catch (e: any) {
      toast.error(e.message || "Erro ao validar PIN");
    } finally { setBusy(false); }
  };

  const createOp = async () => {
    if (newName.trim().length < 2) { toast.error("Nome muito curto"); return; }
    if (!/^[0-9]{4,8}$/.test(newPin)) { toast.error("PIN deve ter 4 a 8 dígitos"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("pdv_upsert_operator" as any, {
        _store_id: storeId, _id: null, _name: newName.trim(), _pin: newPin, _role: newRole,
      } as any);
      if (error) throw error;
      toast.success("Operador cadastrado");
      setNewName(""); setNewPin(""); setNewRole("operador");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar");
    } finally { setBusy(false); }
  };

  const pushDigit = (d: string) => setPin(p => (p.length >= 8 ? p : p + d));
  const popDigit = () => setPin(p => p.slice(0, -1));

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
        <div className="h-12 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {step === "pin" && (
              <button onClick={() => { setStep("pick"); setPin(""); }} className="p-1 rounded hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <p className="text-sm font-black">
              {step === "create" ? "Cadastrar operador"
                : step === "pin" ? selected?.name
                : (title || (requiredRole === "gerente" ? "Autorização de gerente" : "Selecionar operador"))}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : step === "create" ? (
          <div className="p-5 space-y-4">
            {ops.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum operador cadastrado. Crie o primeiro para começar.</p>
            )}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-muted-foreground">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Silvia"
                className="w-full px-3 py-3 bg-muted/40 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-muted-foreground">PIN (4-8 dígitos)</label>
              <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric" placeholder="••••"
                className="w-full px-3 py-3 bg-muted/40 rounded-xl text-center tracking-[0.5em] text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-muted-foreground">Perfil</label>
              <div className="grid grid-cols-2 gap-2">
                {(["operador","gerente"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setNewRole(r)}
                    className={`h-11 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-colors ${
                      newRole === r ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    }`}>
                    {r === "gerente" && <Shield className="h-3.5 w-3.5" />}
                    {r === "operador" ? "Operador" : "Gerente"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Gerente pode autorizar sangrias acima do limite configurado.
              </p>
            </div>
            <button onClick={createOp} disabled={busy}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cadastrar
            </button>
            {ops.length > 0 && (
              <button onClick={() => setStep("pick")} className="w-full text-xs text-muted-foreground hover:text-foreground">
                ← Voltar para lista
              </button>
            )}
          </div>
        ) : step === "pick" ? (
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {ops.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-6">
                {requiredRole === "gerente"
                  ? "Nenhum gerente cadastrado. Cadastre um em Perfil → Operadores."
                  : "Nenhum operador ativo."}
              </p>
            )}
            {ops.map(o => (
              <button key={o.id} onClick={() => { setSelected(o); setStep("pin"); setPin(""); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {o.role === "gerente" ? <Shield className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{o.name}</p>
                  {o.role === "gerente" && <p className="text-[10px] text-primary font-bold uppercase">Gerente</p>}
                </div>
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {!requiredRole && (
              <button onClick={() => setStep("create")}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40">
                <Plus className="h-3.5 w-3.5" /> Adicionar operador
              </button>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="h-16 flex items-center justify-center gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < pin.length ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9"].map(d => (
                <button key={d} onClick={() => pushDigit(d)}
                  className="h-14 rounded-xl bg-muted/40 hover:bg-muted text-xl font-black active:scale-95 transition-transform">
                  {d}
                </button>
              ))}
              <button onClick={() => setPin("")}
                className="h-14 rounded-xl bg-muted/20 text-[11px] font-bold text-muted-foreground">LIMPAR</button>
              <button onClick={() => pushDigit("0")}
                className="h-14 rounded-xl bg-muted/40 hover:bg-muted text-xl font-black active:scale-95">0</button>
              <button onClick={popDigit}
                className="h-14 rounded-xl bg-muted/40 hover:bg-muted flex items-center justify-center">
                <Delete className="h-4 w-4" />
              </button>
            </div>
            <button onClick={tryLogin} disabled={busy || pin.length < 4}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Entrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}