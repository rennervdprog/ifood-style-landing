import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Loader2, MessagesSquare, RefreshCw, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

type InboundRow = {
  id: string;
  phone: string;
  push_name: string | null;
  message: string | null;
  direction: string;
  received_at: string;
  /** Preenchido quando a mensagem foi apagada "para todos" no WhatsApp;
   *  o conteúdo continua no registro e ganha o selo "Apagada". */
  deleted_at?: string | null;
};

type Conversation = {
  phone: string;
  name: string;
  lastMessage: string;
  lastAt: string;
  count: number;
  messages: InboundRow[]; // ordem cronológica (mais antiga → mais nova)
};

function formatPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  if (sameDay) return time;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
  return `${date} ${time}`;
}

function initials(name: string): string {
  const letterParts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (letterParts.length === 1) return letterParts[0].slice(0, 2).toUpperCase();
  if (letterParts.length > 1) return (letterParts[0][0] + letterParts[letterParts.length - 1][0]).toUpperCase();
  // Sem letras (conversa sem nome, identificada pelo telefone formatado):
  // usa o DDD em vez de "(" + primeiro dígito, que gerava o avatar "(9".
  const digits = name.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return local.slice(0, 2) || "?";
}

/** O webhook grava este texto quando a mensagem é só mídia, sem legenda. */
const MEDIA_SENTINEL = "[mensagem sem texto]";
const isMediaOnly = (m: InboundRow) =>
  !m.message || m.message.trim() === "" || m.message.trim() === MEDIA_SENTINEL;

/** Corpo da mensagem: texto, ou cartão amigável para mídia sem legenda
 *  (o registro não guarda o conteúdo da mídia — só o texto). */
function MessageBody({ m, outgoing }: { m: InboundRow; outgoing: boolean }) {
  if (isMediaOnly(m)) {
    return (
      <div className="flex items-start gap-2">
        <ImageIcon className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
        <p className="text-sm">
          Mensagem de mídia (foto, áudio ou documento).
          <span className={`block text-xs mt-0.5 ${outgoing ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            O conteúdo não fica salvo no registro da conversa — só o texto. Abra o WhatsApp para ver.
          </span>
        </p>
      </div>
    );
  }
  return <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>;
}

const WhatsAppConversations = ({ storeId }: Props) => {
  const [rows, setRows] = useState<InboundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("whatsapp_inbound_log" as any) as any)
        .select("id, phone, push_name, message, direction, received_at, deleted_at")
        .eq("store_id", storeId)
        .order("received_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data || []) as InboundRow[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar as conversas");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const conversations = useMemo<Conversation[]>(() => {
    const byPhone = new Map<string, InboundRow[]>();
    for (const r of rows) {
      const arr = byPhone.get(r.phone) || [];
      arr.push(r);
      byPhone.set(r.phone, arr);
    }
    const list: Conversation[] = [];
    for (const [phone, msgs] of byPhone) {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
      );
      const named = [...msgs].find((m) => m.push_name && m.push_name.trim().length > 0);
      const last = sorted[sorted.length - 1];
      list.push({
        phone,
        name: named?.push_name?.trim() || formatPhone(phone),
        lastMessage: last && isMediaOnly(last) ? "Mensagem de mídia" : (last?.message || ""),
        lastAt: last?.received_at || "",
        count: msgs.length,
        messages: sorted,
      });
    }
    return list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  }, [conversations, query]);

  const active = conversations.find((c) => c.phone === selected) || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Mensagens recebidas e enviadas pelo número da loja, registradas automaticamente. Tela somente de leitura.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-card text-muted-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <MessagesSquare className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold text-foreground">Nenhuma conversa registrada ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando um cliente mandar mensagem para o WhatsApp da loja, a conversa aparece aqui.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-3">
          {/* Lista de conversas */}
          <div className={`${selected ? "hidden md:block" : "block"} space-y-2`}>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou número"
                className="w-full text-sm bg-background border border-border rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-0.5">
              {filtered.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setSelected(c.phone)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selected === c.phone ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <span className="shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {initials(c.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{c.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(c.lastAt)}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa encontrada.</p>
              )}
            </div>
          </div>

          {/* Thread da conversa */}
          <div className={`${selected ? "block" : "hidden md:block"}`}>
            {active ? (
              <div className="rounded-xl border border-border bg-background flex flex-col h-full min-h-[320px]">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <button
                    onClick={() => setSelected(null)}
                    className="md:hidden shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {initials(active.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground truncate">{active.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{formatPhone(active.phone)}</span>
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[520px] p-3 space-y-2">
                  {active.messages.map((m) => {
                    const out = m.direction === "out";
                    return (
                      <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                            out
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          <MessageBody m={m} outgoing={out} />
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            {m.deleted_at ? (
                              <span
                                title={`Apagada no WhatsApp em ${formatWhen(m.deleted_at)} — o conteúdo continua salvo no registro`}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  out ? "bg-primary-foreground/25 text-primary-foreground" : "bg-muted-foreground text-background"
                                }`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Apagada
                              </span>
                            ) : null}
                            <p className={`text-[10px] ${out ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {formatWhen(m.received_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center h-full flex flex-col items-center justify-center min-h-[320px]">
                <MessagesSquare className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold text-foreground">Selecione uma conversa</p>
                <p className="mt-1 text-xs text-muted-foreground">As mensagens aparecem aqui, na ordem em que aconteceram.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConversations;
