import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, Loader2, X, AlertTriangle, FileText, Sparkles, ClipboardPaste } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface MenuImportCSVProps {
  storeId: string;
}

interface ParsedProduct {
  section: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  valid: boolean;
  error?: string;
}

type ImportMode = "csv" | "ai";

function parseCSV(text: string): ParsedProduct[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().replace(/["\s]/g, "");
  const sep = header.includes(";") ? ";" : ",";
  return lines.slice(1).map(row => {
    const cols = row.split(sep).map(c => c.replace(/^"|"$/g, "").trim());
    const section = cols[0] || "Sem Seção";
    const name = cols[1] || "";
    const description = cols[2] || "";
    const rawPrice = (cols[3] || "0").replace(",", ".").replace(/[^0-9.]/g, "");
    const price = parseFloat(rawPrice) || 0;
    const available = cols[4] ? !["nao", "não", "false", "0", "n"].includes(cols[4].toLowerCase()) : true;
    const valid = name.length > 0 && price > 0;
    const error = !name ? "Nome vazio" : price <= 0 ? "Preço inválido" : undefined;
    return { section, name, description, price, available, valid, error };
  });
}

export default function MenuImportCSV({ storeId }: MenuImportCSVProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [parsed, setParsed] = useState<ParsedProduct[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const items = parseCSV(text);
      if (items.length === 0) {
        toast.error("Planilha vazia ou formato inválido.");
        return;
      }
      setParsed(items);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handlePDFFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Read as text (works for text-based PDFs exported from Anota Aí)
    // For actual binary PDFs, we extract what we can
    const text = await file.text();

    // Try to extract readable text from the file
    let menuText = text;

    // If it looks like a binary PDF, try to extract text between stream markers
    if (text.startsWith("%PDF")) {
      const textParts: string[] = [];
      const matches = text.match(/\(([^)]+)\)/g);
      if (matches) {
        for (const m of matches) {
          const clean = m.slice(1, -1).replace(/\\[()\\]/g, "");
          if (clean.length > 2 && /[a-zA-ZÀ-ÿ]/.test(clean)) {
            textParts.push(clean);
          }
        }
      }
      menuText = textParts.join(" ");
    }

    if (menuText.trim().length < 10) {
      toast.error("Não foi possível extrair texto do arquivo. Tente copiar e colar o conteúdo manualmente.");
      return;
    }

    await processWithAI(menuText);
  };

  const processWithAI = async (menuText: string) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-menu-pdf", {
        body: { menuText },
      });

      if (error) {
        toast.error("Erro ao processar: " + error.message);
        return;
      }

      if (!data?.success || !data.products?.length) {
        toast.error(data?.error || "Nenhum produto encontrado no texto.");
        return;
      }

      const items: ParsedProduct[] = data.products.map((p: any) => ({
        section: p.section || "Geral",
        name: p.name || "",
        description: p.description || "",
        price: p.price || 0,
        available: true,
        valid: (p.name || "").length > 0 && (p.price || 0) > 0,
        error: !(p.name || "").length ? "Nome vazio" : (p.price || 0) <= 0 ? "Preço inválido" : undefined,
      }));

      setParsed(items);
      toast.success(`${items.filter(i => i.valid).length} produtos identificados pela IA!`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Tente novamente"));
    } finally {
      setAiLoading(false);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    const valid = parsed.filter(p => p.valid);
    if (valid.length === 0) {
      toast.error("Nenhum produto válido para importar.");
      return;
    }

    setImporting(true);
    try {
      const sectionNames = [...new Set(valid.map(p => p.section))];
      const { data: existingSections } = await supabase
        .from("menu_sections")
        .select("id, name")
        .eq("store_id", storeId);

      const sectionMap: Record<string, string> = {};
      for (const es of existingSections || []) {
        sectionMap[es.name.toLowerCase()] = es.id;
      }

      for (const sName of sectionNames) {
        if (!sectionMap[sName.toLowerCase()]) {
          const { data: newSec, error } = await supabase
            .from("menu_sections")
            .insert({ store_id: storeId, name: sName, sort_order: Object.keys(sectionMap).length })
            .select("id")
            .single();
          if (error) throw error;
          sectionMap[sName.toLowerCase()] = newSec.id;
        }
      }

      const productsToInsert = valid.map(p => ({
        store_id: storeId,
        section_id: sectionMap[p.section.toLowerCase()] || null,
        name: p.name,
        description: p.description || null,
        price: p.price,
        is_available: p.available,
      }));

      const { error: prodErr } = await supabase.from("products").insert(productsToInsert);
      if (prodErr) throw prodErr;

      toast.success(`${valid.length} produtos importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["menu-sections", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
      setParsed(null);
      setMode(null);
      setOpen(false);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "Tente novamente"));
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "Seção;Nome;Descrição;Preço;Disponível\nLanches;X-Burguer;Pão, hambúrguer, queijo e salada;18.90;sim\nLanches;X-Bacon;Pão, hambúrguer, bacon e queijo;22.50;sim\nBebidas;Coca-Cola 350ml;Lata gelada;6.00;sim\nBebidas;Suco Natural;Suco de laranja 500ml;8.00;sim";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_cardapio.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsed?.filter(p => p.valid).length || 0;
  const invalidCount = parsed?.filter(p => !p.valid).length || 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-accent/50 text-accent-foreground px-3 py-2 rounded-xl text-xs font-bold hover:bg-accent/70 transition-colors"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Importar Cardápio
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Importar Cardápio
        </h3>
        <button onClick={() => { setOpen(false); setParsed(null); setMode(null); setPasteText(""); }} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode selection */}
      {!mode && !parsed && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("csv")}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
          >
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="text-xs font-bold">Planilha CSV</span>
            <span className="text-[10px] text-muted-foreground text-center">Upload de arquivo CSV com colunas padronizadas</span>
          </button>
          <button
            onClick={() => setMode("ai")}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xs font-bold">IA (Anota Aí / PDF)</span>
            <span className="text-[10px] text-muted-foreground text-center">Cole o texto do cardápio ou envie um arquivo</span>
          </button>
        </div>
      )}

      {/* CSV Mode */}
      {mode === "csv" && !parsed && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Envie um CSV com: <strong>Seção, Nome, Descrição, Preço, Disponível</strong>
          </p>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 rounded-lg text-xs hover:bg-muted/80">
              <Download className="h-3.5 w-3.5" /> Baixar Modelo
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold">
              <Upload className="h-3.5 w-3.5" /> Enviar CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} className="hidden" />
          </div>
          <button onClick={() => setMode(null)} className="text-xs text-muted-foreground hover:underline">← Voltar</button>
        </div>
      )}

      {/* AI Mode */}
      {mode === "ai" && !parsed && !aiLoading && (
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-foreground font-medium mb-1">💡 Como usar:</p>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Abra o <strong>Anota Aí</strong> → Cardápio → selecione tudo e copie</li>
              <li>Cole o texto abaixo e clique em "Processar com IA"</li>
              <li>Ou envie um arquivo PDF/texto do cardápio</li>
            </ol>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Cole aqui o texto do cardápio do Anota Aí, iFood, ou qualquer outro..."
            className="w-full h-32 bg-secondary text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:border-primary focus:outline-none resize-none"
          />

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => pasteText.trim().length >= 10 && processWithAI(pasteText)}
              disabled={pasteText.trim().length < 10}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Processar com IA
            </button>
            <button onClick={() => pdfRef.current?.click()} className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 rounded-lg text-xs hover:bg-muted/80">
              <FileText className="h-3.5 w-3.5" /> Enviar Arquivo
            </button>
            <input ref={pdfRef} type="file" accept=".pdf,.txt,.csv" onChange={handlePDFFile} className="hidden" />
          </div>
          <button onClick={() => { setMode(null); setPasteText(""); }} className="text-xs text-muted-foreground hover:underline">← Voltar</button>
        </div>
      )}

      {/* AI Loading */}
      {aiLoading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Analisando cardápio com IA...</p>
          <p className="text-[10px] text-muted-foreground/60">Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* Results Preview */}
      {parsed && (
        <div className="space-y-3">
          <div className="flex gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400 font-bold">✓ {validCount} válidos</span>
            {invalidCount > 0 && (
              <span className="text-destructive font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {invalidCount} com erro
              </span>
            )}
          </div>

          <div className="max-h-60 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Seção</th>
                  <th className="text-left px-2 py-1.5 font-medium">Nome</th>
                  <th className="text-right px-2 py-1.5 font-medium">Preço</th>
                  <th className="text-center px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p, i) => (
                  <tr key={i} className={`border-t border-border ${!p.valid ? "bg-destructive/10" : ""}`}>
                    <td className="px-2 py-1.5 text-muted-foreground">{p.section}</td>
                    <td className="px-2 py-1.5">{p.name || "—"}</td>
                    <td className="px-2 py-1.5 text-right">R$ {p.price.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {p.valid ? (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        <span className="text-destructive text-[10px]">{p.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={doImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Importar {validCount} Produtos
            </button>
            <button onClick={() => { setParsed(null); setMode(null); setPasteText(""); }} className="text-muted-foreground text-xs px-3 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
