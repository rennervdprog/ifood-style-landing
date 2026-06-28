import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * Bloqueia o app do cliente até que ele defina um PIN de entrega de 4 dígitos.
 * Usado para clientes antigos criados antes da obrigatoriedade do PIN.
 */
const DeliveryPinSetupGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) { setChecking(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("delivery_pin, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const role = (data as any)?.role;
      // Só exige PIN para clientes finais
      if (role && role !== "cliente") { setChecking(false); return; }
      const current = (data as any)?.delivery_pin as string | null | undefined;
      setNeedsPin(!current || !/^\d{4}$/.test(current));
      setChecking(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) { toast.error("O PIN deve ter 4 dígitos numéricos."); return; }
    if (pin !== confirmPin) { toast.error("Os PINs não coincidem."); return; }
    if (!ack) { toast.error("Confirme que este PIN será usado em todas as entregas."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ delivery_pin: pin })
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success("PIN de entrega definido!");
      setNeedsPin(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar PIN.");
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!needsPin) return <>{children}</>;

  const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-slate-50 flex items-start justify-center px-5 py-10">
      <form onSubmit={handleSave} className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground">Defina seu PIN de entrega</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Agora todo cliente precisa ter um PIN pessoal de 4 dígitos. Esse código será exigido pelo entregador em <strong>todas</strong> as suas entregas.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 flex gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Evite datas óbvias (aniversário, ano de nascimento). Escolha algo que só você saiba e memorize bem — sem o PIN o entregador não libera o pedido.
          </p>
        </div>

        <label className="block text-xs font-semibold text-foreground mb-1">PIN de 4 dígitos</label>
        <input
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(onlyDigits(e.target.value))}
          placeholder="0000"
          className="w-full h-12 px-4 mb-3 rounded-xl border border-border bg-white text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />

        <label className="block text-xs font-semibold text-foreground mb-1">Confirme o PIN</label>
        <input
          inputMode="numeric"
          value={confirmPin}
          onChange={(e) => setConfirmPin(onlyDigits(e.target.value))}
          placeholder="0000"
          className="w-full h-12 px-4 mb-4 rounded-xl border border-border bg-white text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            Entendo que este PIN será usado em <strong>todas</strong> as entregas e sou responsável por guardá-lo.
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar PIN e continuar"}
        </button>
      </form>
    </div>
  );
};

export default DeliveryPinSetupGate;