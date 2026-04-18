import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Megaphone, Info } from "lucide-react";

type Audience = "clients" | "partners" | "all";

const AdminBroadcastPush = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/");
  const [audience, setAudience] = useState<Audience>("clients");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; total: number } | null>(null);

  const send = async () => {
    const t = title.trim();
    const b = body.trim();
    const l = link.trim() || "/";

    if (!t) {
      toast.error("Digite um título.");
      return;
    }
    if (t.length > 120) {
      toast.error("Título muito longo (máx 120).");
      return;
    }
    if (b.length > 500) {
      toast.error("Mensagem muito longa (máx 500).");
      return;
    }
    if (!l.startsWith("/") && !l.startsWith("https://")) {
      toast.error("Link deve começar com / ou https://");
      return;
    }

    if (!confirm(`Enviar para "${audience === "clients" ? "Clientes" : audience === "partners" ? "Lojistas + Motoboys" : "Todos"}"?`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-broadcast-push", {
        body: { title: t, body: b, link: l, audience },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const sent = Number((data as any)?.sent || 0);
      const total = Number((data as any)?.total_targets || 0);
      setLastResult({ sent, total });
      toast.success(`Notificação enviada! ${sent} entregues de ${total} dispositivos.`);
      setTitle("");
      setBody("");
    } catch (e: any) {
      console.error("[broadcast] error:", e);
      toast.error(e?.message || "Falha ao enviar notificação.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Enviar notificação em massa</h3>
            <p className="text-xs text-muted-foreground">Push para todos os usuários do app</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Público-alvo</Label>
          <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="clients">📱 Clientes (app cliente)</SelectItem>
              <SelectItem value="partners">🛵 Lojistas + Motoboys</SelectItem>
              <SelectItem value="all">🌐 Todos os usuários</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Título *</Label>
          <Input
            placeholder="Ex: Pizzaria do Zé está aberta agora! 🍕"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <p className="text-[10px] text-muted-foreground">{title.length}/120</p>
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            placeholder="Ex: Promoção até 22h. Toque para ver o cardápio."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-[10px] text-muted-foreground">{body.length}/500</p>
        </div>

        <div className="space-y-2">
          <Label>Link ao tocar (deep link)</Label>
          <Input
            placeholder="/store/slug-da-loja"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            Ex: <code>/store/pizza-do-ze</code>, <code>/</code> (home), <code>/pedidos</code> ou URL completa <code>https://...</code>
          </p>
        </div>

        <Button onClick={send} disabled={sending || !title.trim()} className="w-full" size="lg">
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Enviando..." : "Enviar agora"}
        </Button>

        {lastResult && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm">
            ✅ <strong>{lastResult.sent}</strong> push entregues de <strong>{lastResult.total}</strong> alvos.
          </div>
        )}
      </Card>

      <Card className="p-4 bg-muted/30">
        <div className="flex gap-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Dicas:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Use emojis no título para chamar atenção 🔥</li>
              <li>O link abre direto no app instalado, ou no navegador no PWA</li>
              <li>Apenas usuários com app instalado e notificações ativas recebem</li>
              <li>Evite enviar várias vezes ao dia — usuários podem desativar</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminBroadcastPush;
