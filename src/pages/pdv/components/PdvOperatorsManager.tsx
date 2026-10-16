import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, Plus, Pencil, KeyRound, UserX, UserCheck,
  X, Loader2, ShieldCheck, Crown, User,
} from "lucide-react";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";

interface Operator {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at?: string;
}

interface Props {
  storeId: string;
}

export function PdvOperatorsManager({ storeId }: Props) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showGate, setShowGate] = useState(true);

  // Form states
  const [editing, setEditing] = useState<Operator | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRole, setFormRole] = useState<"gerente" | "operador">("operador");
  const [saving, setSaving] = useState(false);
  const [changingPinFor, setChangingPinFor] = useState<Operator | null>(null);
  const [newPin, setNewPin] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("pdv_list_operators" as any, {
        _store_id: storeId,
      } as any);
      if (error) throw error;
      setOperators((data as Operator[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar operadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  const handleAuthorized = () => {
    setAuthorized(true);
    setShowGate(false);
  };

  const openNew = () => {
    setEditing(null);
    setFormName("");
    setFormPin("");
    setFormRole("operador");
    setShowForm(true);
  };

  const openEdit = (op: Operator) => {
    setEditing(op);
    setFormName(op.name);
    setFormPin("");
    setFormRole(op.role as "gerente" | "operador");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (formName.trim().length < 2) {
      toast.error("Digite o nome");
      return;
    }
    if (!editing && !/^[0-9]{4,8}$/.test(formPin)) {
      toast.error("PIN de 4 a 8 dígitos");
      return;
    }
    if (formPin && !/^[0-9]{4,8}$/.test(formPin)) {
      toast.error("PIN de 4 a 8 dígitos");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("pdv_upsert_operator" as any, {
        _store_id: storeId,
        _id: editing?.id || null,
        _name: formName.trim(),
        _pin: formPin || null,
        _role: formRole,
      } as any);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("last_manager")) {
          toast.error("Não pode remover o último gerente");
        } else if (msg.includes("invalid_pin")) {
          toast.error("PIN inválido (4 a 8 dígitos)");
        } else {
          toast.error(msg || "Erro ao salvar");
        }
        return;
      }
      toast.success(editing ? "Operador atualizado" : "Operador criado");
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (op: Operator) => {
    // Não permite desativar o último gerente
    if (op.role === "gerente" && op.active) {
      const otherManagers = operators.filter(
        (o) => o.id !== op.id && o.role === "gerente" && o.active
      );
      if (otherManagers.length === 0) {
        toast.error("Não pode desativar o último gerente");
        return;
      }
    }
    try {
      const { error } = await supabase.rpc("pdv_set_operator_active" as any, {
        _store_id: storeId,
        _id: op.id,
        _active: !op.active,
      } as any);
      if (error) throw error;
      toast.success(op.active ? "Operador desativado" : "Operador ativado");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  };

  const handleChangePin = async () => {
    if (!changingPinFor) return;
    if (!/^[0-9]{4,8}$/.test(newPin)) {
      toast.error("PIN de 4 a 8 dígitos");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("pdv_upsert_operator" as any, {
        _store_id: storeId,
        _id: changingPinFor.id,
        _name: changingPinFor.name,
        _pin: newPin,
        _role: changingPinFor.role,
      } as any);
      if (error) throw error;
      toast.success("PIN atualizado");
      setChangingPinFor(null);
      setNewPin("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao trocar PIN");
    } finally {
      setSaving(false);
    }
  };

  // Gate de autorização
  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <p className="font-bold text-lg">Área do gerente</p>
        <p className="text-sm text-muted-foreground mt-1 mb-6 text-center">
          Só o gerente pode gerenciar operadores.
        </p>
        <PdvOperatorLoginDialog
          open={showGate}
          storeId={storeId}
          onClose={() => setShowGate(false)}
          onLogin={handleAuthorized}
          requiredRole="gerente"
          title="Autorização do gerente"
        />
        {!showGate && (
          <button
            onClick={() => setShowGate(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold"
          >
            Autorizar com PIN do gerente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-black text-lg">Operadores</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : operators.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">Nenhum operador cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre o primeiro operador para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {operators.map((op) => (
            <div
              key={op.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                op.active ? "bg-card border-border" : "bg-muted/30 border-transparent opacity-60"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  op.role === "gerente" ? "bg-amber-500/15" : "bg-primary/10"
                }`}
              >
                {op.role === "gerente" ? (
                  <Crown className="h-5 w-5 text-amber-600" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{op.name}</p>
                <p className="text-xs text-muted-foreground">
                  {op.role === "gerente" ? "Gerente" : "Operador"}
                  {!op.active && " · Desativado"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(op)}
                  title="Editar"
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setChangingPinFor(op)}
                  title="Trocar PIN"
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(op)}
                  title={op.active ? "Desativar" : "Ativar"}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    op.active
                      ? "bg-red-500/10 text-red-600"
                      : "bg-green-500/10 text-green-600"
                  }`}
                >
                  {op.active ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: Novo/Editar */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl border shadow-2xl overflow-hidden">
            <div className="h-12 border-b flex items-center justify-between px-4">
              <p className="text-sm font-black">
                {editing ? "Editar operador" : "Novo operador"}
              </p>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Nome
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Maria"
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  PIN (4 a 8 dígitos) {editing && "(deixe vazio para manter)"}
                </label>
                <input
                  value={formPin}
                  onChange={(e) =>
                    setFormPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  inputMode="numeric"
                  placeholder="••••"
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 rounded-xl text-center tracking-[0.5em] font-black focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Cargo
                </label>
                <div className="flex gap-2 mt-1">
                  {(["operador", "gerente"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFormRole(r)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${
                        formRole === r
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 border-transparent"
                      }`}
                    >
                      {r === "gerente" ? "Gerente" : "Operador"}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar operador"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Trocar PIN */}
      {changingPinFor && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl border shadow-2xl overflow-hidden">
            <div className="h-12 border-b flex items-center justify-between px-4">
              <p className="text-sm font-black">Trocar PIN — {changingPinFor.name}</p>
              <button
                onClick={() => {
                  setChangingPinFor(null);
                  setNewPin("");
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Novo PIN (4 a 8 dígitos)
                </label>
                <input
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  inputMode="numeric"
                  placeholder="••••"
                  className="w-full mt-1 px-3 py-3 bg-muted/40 rounded-xl text-center tracking-[0.5em] text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                onClick={handleChangePin}
                disabled={saving}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-black disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar novo PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
