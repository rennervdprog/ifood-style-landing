import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Send, X, ChefHat, Package, Truck, CheckCircle2, XCircle, Bell, Check, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/firebase";

interface OrderChatProps {
  orderId: string;
  storeName: string;
  storeOwnerId?: string;
  clientId?: string;
  driverId?: string | null;
  defaultOpen?: boolean;
}

const SYSTEM_PREFIXES = ["📋", "👨‍🍳", "📦", "🛵", "✅", "🏁", "❌"];

const isSystemMessage = (message: string) =>
  SYSTEM_PREFIXES.some((p) => message.startsWith(p));

const getSystemIcon = (message: string) => {
  if (message.startsWith("👨‍🍳")) return ChefHat;
  if (message.startsWith("📦")) return Package;
  if (message.startsWith("🛵")) return Truck;
  if (message.startsWith("✅") || message.startsWith("🏁")) return CheckCircle2;
  if (message.startsWith("❌")) return XCircle;
  return Bell;
};

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const OrderChat = ({ orderId, storeName, storeOwnerId, clientId, driverId, defaultOpen = false }: OrderChatProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track unread messages even when closed
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`order-chat-unread-${orderId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_messages",
        filter: `order_id=eq.${orderId}`,
      }, (payload: any) => {
        const msg = payload.new;
        if (msg.sender_id !== user.id && !open) {
          setUnreadCount((c) => c + 1);
        }
        if (open) {
          setMessages((prev) => {
            if (prev.some((m: any) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, user, open]);

  // Fetch messages when opened
  useEffect(() => {
    if (!open || !user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("order_messages" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setUnreadCount(0);
    };

    fetchMessages();
  }, [open, orderId, user]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const getRecipientIds = useCallback((): string[] => {
    if (!user) return [];
    const recipients: string[] = [];
    if (clientId && clientId !== user.id) recipients.push(clientId);
    if (storeOwnerId && storeOwnerId !== user.id) recipients.push(storeOwnerId);
    if (driverId && driverId !== user.id) recipients.push(driverId);
    return recipients;
  }, [user, clientId, storeOwnerId, driverId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("order_messages" as any).insert({
        order_id: orderId,
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;

      const recipients = getRecipientIds();
      if (recipients.length > 0) {
        sendPushNotification(
          recipients,
          `💬 Nova mensagem - ${storeName}`,
          newMessage.trim().slice(0, 100),
          { link: "/pedidos", order_id: orderId }
        ).catch(console.error);
      }

      setNewMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; messages: any[] }[], msg) => {
    const dateKey = formatDate(msg.created_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
    return groups;
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Chat
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-border flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header — WhatsApp style */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm truncate">{storeName}</h3>
            <p className="text-[10px] opacity-80">Pedido #{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages area — WhatsApp style background */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-[300px] max-h-[60vh]"
          style={{
            backgroundColor: "hsl(var(--muted) / 0.3)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        >
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-primary/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Acompanhe seu pedido aqui
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[250px] mx-auto">
                As atualizações de status e mensagens da loja aparecerão automaticamente.
              </p>
            </div>
          )}

          {groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex justify-center my-3">
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                  {group.date}
                </span>
              </div>

              {group.messages.map((msg: any) => {
                const isMine = msg.sender_id === user?.id;
                const isSystem = isSystemMessage(msg.message);

                if (isSystem) {
                  const Icon = getSystemIcon(msg.message);
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 max-w-[85%] shadow-sm backdrop-blur-sm">
                        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-snug">{msg.message}</span>
                        <span className="text-[9px] text-amber-500/70 flex-shrink-0 ml-1">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={`relative max-w-[80%] px-3 py-2 shadow-sm ${
                        isMine
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-foreground rounded-2xl rounded-br-sm"
                          : "bg-card text-foreground rounded-2xl rounded-bl-sm border border-border/50"
                      }`}
                    >
                      {/* Tail */}
                      <div
                        className={`absolute bottom-0 w-3 h-3 ${
                          isMine
                            ? "-right-1.5 bg-emerald-100 dark:bg-emerald-900/40"
                            : "-left-1.5 bg-card"
                        }`}
                        style={{
                          clipPath: isMine
                            ? "polygon(0 0, 100% 100%, 0 100%)"
                            : "polygon(100% 0, 0 100%, 100% 100%)",
                        }}
                      />
                      <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                      <div className={`flex items-center gap-1 justify-end mt-0.5 ${isMine ? "-mb-0.5" : ""}`}>
                        <span className="text-[9px] text-muted-foreground/60">
                          {formatTime(msg.created_at)}
                        </span>
                        {isMine && (
                          <CheckCheck className="h-3 w-3 text-blue-500/70" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area — WhatsApp style */}
        <div className="px-3 py-2.5 border-t border-border flex gap-2 items-end bg-muted/30">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Mensagem"
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-primary text-primary-foreground p-2.5 rounded-full disabled:opacity-50 active:scale-95 transition-all hover:shadow-md flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderChat;