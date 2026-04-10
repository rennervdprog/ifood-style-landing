import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Send, X, ChefHat, Package, Truck, CheckCircle2, XCircle, Bell } from "lucide-react";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/firebase";

interface OrderChatProps {
  orderId: string;
  storeName: string;
  storeOwnerId?: string;
  clientId?: string;
  driverId?: string | null;
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

const OrderChat = ({ orderId, storeName, storeOwnerId, clientId, driverId }: OrderChatProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

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

      // Send push notification to other participants
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
      <div className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-border flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Chat do Pedido
            </h3>
            <p className="text-[10px] text-muted-foreground">{storeName} • #{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[250px] max-h-[50vh]">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">
                As atualizações do pedido aparecerão aqui automaticamente.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Você também pode enviar mensagens para a loja.
              </p>
            </div>
          )}
          {messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            const isSystem = isSystemMessage(msg.message);

            if (isSystem) {
              const Icon = getSystemIcon(msg.message);
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 max-w-[90%]">
                    <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-medium">{msg.message}</span>
                    <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}>
                  <p className="break-words">{msg.message}</p>
                  <p className={`text-[9px] mt-0.5 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border flex gap-2 bg-card">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Digite sua mensagem..."
            maxLength={500}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-primary text-primary-foreground p-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderChat;
