import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Send, X, ChefHat, Package, Truck, CheckCircle2, XCircle, Bell, CheckCheck } from "lucide-react";
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

  // Determine if current user is the store owner
  const isStoreOwner = user?.id === storeOwnerId;
  const isDriver = user?.id === driverId;

  // Persistent badge channel — does NOT depend on `open`, so toggling the chat
  // does not destroy/recreate the subscription.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`order-chat-${orderId}-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_messages",
        filter: `order_id=eq.${orderId}`,
      }, (payload: any) => {
        const msg = payload.new;
        const isOpen = openRef.current;
        if (msg.sender_id !== user.id && !isOpen) {
          setUnreadCount((c) => c + 1);
        }
        if (isOpen) {
          setMessages((prev) => {
            if (prev.some((m: any) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      });
    subscribeWithRejoin(channel);
    return () => { cleanupChannel(channel); };
  }, [orderId, user]);

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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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

  /**
   * Determines if a message should render on the RIGHT side for the current viewer.
   * 
   * For the STORE OWNER viewing:
   *   - Their own messages → RIGHT (green)
   *   - System/status messages (sent by store trigger) → RIGHT (green, they "own" these)
   *   - Client messages → LEFT (white)
   * 
   * For the CLIENT viewing:
   *   - Their own messages → RIGHT (green)
   *   - System/status messages → LEFT (white, "from the store")
   *   - Store owner messages → LEFT (white)
   * 
   * For DRIVERS:
   *   - Their own messages → RIGHT
   *   - Everything else → LEFT
   */
  const isBubbleRight = (msg: any): boolean => {
    const isMine = msg.sender_id === user?.id;
    if (isMine) return true;

    const isSystem = isSystemMessage(msg.message);
    if (isSystem && isStoreOwner) return true; // store sees system msgs on right
    
    return false;
  };

  const getSenderLabel = (msg: any): string | null => {
    const isMine = msg.sender_id === user?.id;
    const isSystem = isSystemMessage(msg.message);
    if (isMine || isSystem) return null;

    if (msg.sender_id === storeOwnerId) return storeName;
    if (msg.sender_id === driverId) return "🛵 Entregador";
    if (msg.sender_id === clientId) return "Cliente";
    return null;
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
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#075E54" }}>
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-white truncate">{storeName}</h3>
            <p className="text-[11px] text-white/70">Pedido #{orderId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 min-h-[320px] max-h-[65vh]"
          style={{ backgroundColor: "#ECE5DD" }}
        >
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#075E54]/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-[#075E54]/40" />
              </div>
              <p className="text-sm font-semibold text-[#303030]">
                Acompanhe seu pedido aqui
              </p>
              <p className="text-xs text-[#667781] mt-1 max-w-[250px] mx-auto">
                Atualizações de status e mensagens aparecerão automaticamente.
              </p>
            </div>
          )}

          {groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex justify-center my-3">
                <span className="text-[11px] font-medium text-[#54656F] bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                  {group.date}
                </span>
              </div>

              {group.messages.map((msg: any) => {
                const right = isBubbleRight(msg);
                const isSystem = isSystemMessage(msg.message);
                const senderLabel = getSenderLabel(msg);
                const Icon = isSystem ? getSystemIcon(msg.message) : null;

                return (
                  <div key={msg.id} className={`flex ${right ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className="relative max-w-[82%] px-2.5 py-1.5 shadow-sm"
                      style={{
                        backgroundColor: right ? "#D9FDD3" : "#FFFFFF",
                        borderRadius: right
                          ? "8px 0px 8px 8px"
                          : "0px 8px 8px 8px",
                      }}
                    >
                      {/* Tail */}
                      <div
                        className="absolute top-0 w-2 h-3"
                        style={{
                          [right ? "right" : "left"]: "-7px",
                          backgroundColor: right ? "#D9FDD3" : "#FFFFFF",
                          clipPath: right
                            ? "polygon(0 0, 100% 0, 0 100%)"
                            : "polygon(0 0, 100% 0, 100% 100%)",
                        }}
                      />

                      {/* Sender label (for multi-party chats) */}
                      {senderLabel && (
                        <p className="text-[11px] font-bold mb-0.5" style={{ color: "#075E54" }}>
                          {senderLabel}
                        </p>
                      )}

                      {/* System icon inline */}
                      {isSystem && Icon ? (
                        <div className="flex items-start gap-1.5">
                          <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#075E54" }} />
                          <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap" style={{ color: "#111B21" }}>
                            {msg.message}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap" style={{ color: "#111B21" }}>
                          {msg.message}
                        </p>
                      )}

                      {/* Time + read receipt */}
                      <div className="flex items-center gap-1 justify-end -mb-0.5 mt-0.5">
                        <span className="text-[10px]" style={{ color: "#667781" }}>
                          {formatTime(msg.created_at)}
                        </span>
                        {right && (
                          <CheckCheck className="h-3.5 w-3.5" style={{ color: "#53BDEB" }} />
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

        {/* ── Input ── */}
        <div className="px-2 py-2 flex gap-2 items-end" style={{ backgroundColor: "#F0F2F5" }}>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Mensagem"
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-full border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#075E54]/30"
            style={{ backgroundColor: "#FFFFFF", color: "#111B21" }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="p-2.5 rounded-full disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
            style={{ backgroundColor: "#075E54", color: "#FFFFFF" }}
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderChat;
