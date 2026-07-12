/**
 * Aviso sobre Passkey do WhatsApp — libs não-oficiais (Baileys/Evolution) ainda
 * não suportam o novo fluxo de passkey introduzido pela Meta em 2026.
 * Se o usuário não consegue parear, provavelmente a conta tem passkey ativa.
 */
import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  /** Se true, destaca (vermelho). Se false, fica em tom informativo (âmbar). */
  highlight?: boolean;
  className?: string;
}

export default function PasskeyWarning({ highlight = false, className = "" }: Props) {
  const [open, setOpen] = useState(highlight);
  const tone = highlight
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";

  return (
    <div className={`rounded-xl border ${tone} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p className="text-xs font-bold flex-1">
          {highlight ? "Não conectou? Pode ser Passkey" : "Sua conta tem Passkey do WhatsApp?"}
        </p>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-[11px] text-foreground/80 leading-relaxed">
          <p>
            Contas com <strong>Passkey ativa</strong> não conectam pelo nosso servidor ainda —
            o WhatsApp exige biometria ao parear, e o suporte nas libs abertas está em desenvolvimento
            (previsão: próximas semanas).
          </p>
          <div className="space-y-1">
            <p className="font-bold text-foreground">Como desativar temporariamente:</p>
            <p><strong className="text-foreground">1.</strong> Abra o WhatsApp no celular</p>
            <p><strong className="text-foreground">2.</strong> Config <span className="opacity-60">→</span> Conta <span className="opacity-60">→</span> <strong>Chaves de acesso (Passkeys)</strong></p>
            <p><strong className="text-foreground">3.</strong> Remova a chave de acesso salva</p>
            <p><strong className="text-foreground">4.</strong> Volte aqui e gere o código/QR novamente</p>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
            Assim que o suporte oficial chegar, você poderá reativar a Passkey normalmente.
          </p>
        </div>
      )}
    </div>
  );
}