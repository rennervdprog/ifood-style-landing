/**
 * Aba "Mensagens" — editor de templates com preview tipo bolha do WhatsApp.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Eye, AlertTriangle } from "lucide-react";
import { DEFAULT_TEMPLATES, TemplateKey, TEMPLATE_VARIABLES, fillTemplate, SAMPLE_DATA } from "./templates";
import WhatsAppBubblePreview from "./WhatsAppBubblePreview";

interface Props {
  storeName: string;
  templates: Record<string, string>;
  setTemplates: (t: Record<string, string>) => void;
}

export default function WhatsAppTemplates({ storeName, templates, setTemplates }: Props) {
  const [openKey, setOpenKey] = useState<TemplateKey | null>("preparando");
  const sample = { ...SAMPLE_DATA, storeName };

  const updateTemplate = (key: TemplateKey, value: string) => {
    setTemplates({ ...templates, [key]: value });
  };
  const resetTemplate = (key: TemplateKey) => {
    const next = { ...templates };
    delete next[key];
    setTemplates(next);
  };
  const insertVariable = (key: TemplateKey, variable: string) => {
    const current = templates[key] ?? DEFAULT_TEMPLATES[key].template;
    updateTemplate(key, `${current}${variable}`);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-0.5">💡 Edite à vontade</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Use <code className="bg-muted px-1 rounded">*texto*</code> para negrito. Clique numa variável para inserir. O preview mostra exatamente como o cliente vai ver no WhatsApp.
        </p>
      </div>

      {(Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((key) => {
        const info = DEFAULT_TEMPLATES[key];
        const value = templates[key] ?? info.template;
        const isCustom = templates[key] !== undefined && templates[key] !== info.template;
        const isOpen = openKey === key;
        const missingPin = (key === "pronto_para_entrega" || key === "saiu_entrega") && !value.includes("{pin}");

        return (
          <div key={key} className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="text-xl shrink-0">{info.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-foreground truncate">{info.label}</p>
                  {isCustom && (
                    <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold shrink-0">EDITADO</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{info.shortDesc}</p>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="border-t border-border bg-muted/20 p-3 space-y-3">
                {missingPin && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                      Você removeu <code>{"{pin}"}</code> — o cliente não receberá o código de segurança para o motoboy.
                    </p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  {/* Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Mensagem</label>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => resetTemplate(key)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Restaurar padrão
                        </button>
                      )}
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => updateTemplate(key, e.target.value)}
                      rows={8}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariable(key, v.key)}
                          title={v.desc}
                          className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                        >
                          {v.key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Preview no WhatsApp
                    </label>
                    <WhatsAppBubblePreview text={fillTemplate(value, sample)} storeName={storeName} />
                    <p className="text-[10px] text-muted-foreground text-center">Dados de exemplo: cliente {sample.clientName}, pedido #{sample.orderId}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}