import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, RefreshCw, QrCode, Send, Loader2 } from "lucide-react";

type Cfg = {
  id?: string;
  instance_name: string;
  phone_number?: string | null;
  status?: string | null;
  connected_at?: string | null;
  support_display_name?: string | null;
  support_link_message?: string | null;
  avisos_ativos?: boolean;
};

export default function PlatformWhatsAppTab() {
  const qc = useQueryClient();
  const [testPhone, setTestPhone] = useState("");
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);

  const formatBrPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (!digits || digits === "55") return "";

    const localDigits = (digits.startsWith("55") ? digits.slice(2) : digits).slice(0, 11);
    if (!localDigits) return "";

    const ddd = localDigits.slice(0, 2);
    const rest = localDigits.slice(2);
    let out = "+55";
    if (ddd) out += ` (${ddd}`;
    if (ddd.length === 2) out += ")";
    if (rest) {
      if (rest.length <= 5) out += ` ${rest}`;
      else out += ` ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
    }
    return out;
  };
  const [supportNumber, setSupportNumber] = useState("");

  const { data: cfg } = useQuery({
    queryKey: ["platform-wa-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_whatsapp_config" as any).select("*").limit(1).maybeSingle();
      return (data as any as Cfg) || null;
    },
    refetchInterval: 15_000,
  });

  const { data: supportCfg } = useQuery({
    queryKey: ["support-whatsapp-cfg-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "support_whatsapp").maybeSingle();
      return (data?.value as { number?: string } | null) || null;
    },
  });

  useEffect(() => {
    if (supportCfg?.number != null) setSupportNumber(supportCfg.number);
  }, [supportCfg?.number]);

  const saveCfg = useMutation({
    mutationFn: async (patch: Partial<Cfg>) => {
      const { error } = await supabase
        .from("platform_whatsapp_config" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", cfg!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] }); toast({ title: "Salvo" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveSupport = useMutation({
    mutationFn: async () => {
      const number = supportNumber.replace(/\D/g, "");
      const link = number ? `https://wa.me/${number}` : "";
      const { error } = await supabase
        .from("admin_settings")
        .upsert({ key: "support_whatsapp", value: { number, link } }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Número de suporte salvo" }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fetchQr = async () => {
    setQrLoading(true); setQrData(null); setPairingCode(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-qr-code", {
        body: { instance_name: cfg?.instance_name || "itasuper-platform", is_platform: true },
      });
      if (error) throw error;
      setQrData((data as any)?.qr_base64 || (data as any)?.base64 || null);
    } catch (e: any) {
      toast({ title: "Erro QR", description: e.message, variant: "destructive" });
    } finally { setQrLoading(false); }
  };

  const fetchPairing = async () => {
    const phone = pairingPhone.replace(/\D/g, "");
    if (phone.length < 10) return toast({ title: "Número inválido", description: "Formato: 5522999999999", variant: "destructive" });
    setPairingLoading(true); setPairingCode(null); setQrData(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-qr-code", {
        body: { instance_name: cfg?.instance_name || "itasuper-platform", is_platform: true, pairing_number: phone, force_reconnect: true },
      });
      if (error) throw error;
      const code = (data as any)?.pairing_code as string | null;
      if (!code) throw new Error("Evolution não retornou pairing code");
      setPairingCode(code);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setPairingLoading(false); }
  };

  const sendTest = async () => {
    const phone = testPhone.replace(/\D/g, "");
    if (phone.length < 10) return toast({ title: "Número inválido", variant: "destructive" });
    const { data, error } = await supabase.functions.invoke("platform-whatsapp-send", {
      body: { phone, message: `Teste ItaSuper — ${new Date().toLocaleString("pt-BR")}`, kind: "test", force: true },
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    if ((data as any)?.error) return toast({ title: "Falhou", description: (data as any).error, variant: "destructive" });
    toast({ title: "Enviado!" });
  };

  const statusColor = cfg?.status === "connected" ? "text-green-600" : "text-amber-600";

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-black">WhatsApp da Plataforma</h2>
          <p className="text-xs text-muted-foreground">Instância dedicada para avisar lojistas em nome da ItaSuper</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Instância</div>
            <div className="font-mono font-bold">{cfg?.instance_name || "itasuper-platform"}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className={`font-bold ${statusColor}`}>{cfg?.status || "desconhecido"}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchQr} disabled={qrLoading} variant="outline" size="sm">
            {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Gerar QR Code
          </Button>
          <Button onClick={() => qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] })} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" /> Atualizar status
          </Button>
        </div>

        {qrData && (
          <div className="p-3 bg-white rounded-lg flex justify-center">
            <img src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`} alt="QR" className="max-w-[280px]" />
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <div className="font-bold">Conectar por número (código de 8 dígitos)</div>
          <div className="text-xs text-muted-foreground">
            No WhatsApp do celular: Aparelhos conectados → Conectar aparelho → <b>Conectar com número de telefone</b>. Digite o código gerado abaixo.
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={pairingPhone}
            onChange={(e) => setPairingPhone(formatBrPhone(e.target.value))}
            placeholder="+55 (22) 99999-9999"
            inputMode="tel"
            maxLength={20}
          />
          <Button onClick={fetchPairing} disabled={pairingLoading}>
            {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar código"}
          </Button>
        </div>
        {pairingCode && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
            <div className="text-xs text-muted-foreground mb-1">Digite este código no WhatsApp:</div>
            <div className="text-3xl font-black font-mono tracking-widest text-green-700 dark:text-green-400">
              {pairingCode.length === 8 ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}` : pairingCode}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">Válido por ~60s. Se expirar, gere outro.</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">Avisos automáticos</div>
            <div className="text-xs text-muted-foreground">Ativa envios de lembretes (mensalidade, upgrade Essencial)</div>
          </div>
          <Switch
            checked={!!cfg?.avisos_ativos}
            onCheckedChange={(v) => saveCfg.mutate({ avisos_ativos: v })}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Label className="text-sm font-bold">Número de suporte visível ao lojista</Label>
        <p className="text-xs text-muted-foreground">Usado nos botões "Falar com suporte" dentro do app. Formato: 5522992796291</p>
        <div className="flex gap-2">
          <Input value={supportNumber} onChange={(e) => setSupportNumber(e.target.value)} placeholder="5522992796291" />
          <Button onClick={() => saveSupport.mutate()} disabled={saveSupport.isPending}>Salvar</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Label className="text-sm font-bold">Testar envio</Label>
        <div className="flex gap-2">
          <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5522..." />
          <Button onClick={sendTest} disabled={cfg?.status !== "connected"}>
            <Send className="h-4 w-4 mr-1" /> Enviar teste
          </Button>
        </div>
      </div>
    </div>
  );
}