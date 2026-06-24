import { Keyboard } from "lucide-react";

export const PdvShortcutsDialog = ({ onClose }: { onClose: () => void }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-card rounded-2xl border border-border w-full max-w-sm p-5 space-y-3 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Keyboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-black text-base">Atalhos de teclado</h3>
          <p className="text-[11px] text-muted-foreground">Acelere o atendimento</p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          ["F2", "Focar busca de produtos"],
          ["F3", "Abrir/fechar desconto"],
          ["F4", "Trocar forma de pagamento"],
          ["F8", "Finalizar venda"],
          ["ESC", "Limpar venda atual"],
          ["Scanner", "Leitor USB adiciona ao carrinho"],
        ].map(([k, desc]) => (
          <div key={k} className="flex items-center justify-between bg-muted/30 px-3 py-2 rounded-lg">
            <span className="text-xs text-muted-foreground">{desc}</span>
            <kbd className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-black text-foreground">
              {k}
            </kbd>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
      >
        Entendi
      </button>
    </div>
  </div>
);