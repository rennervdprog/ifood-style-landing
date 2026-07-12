import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, RefreshCw, QrCode, Send, Loader2, History, Settings, Link as LinkIcon, Copy, Check, Smartphone, CheckCircle2, Phone, Power } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlatformWhatsAppHistory from "./PlatformWhatsAppHistory";
import PasskeyWarning from "@/components/whatsapp/PasskeyWarning";

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
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    if (!pairingExpiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((pairingExpiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [pairingExpiresAt]);

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

  const getFunctionErrorMessage = async (error: any) => {
    const fallback = error?.message || "Falha na função";
    const context = error?.context;
    if (!context || typeof context.text !== "function") return fallback;
    const text = await context.text().catch(() => "");
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed?.error || parsed?.message || text.slice(0, 180);
    } catch {
      return text.slice(0, 180);
    }
  };

  const invokeWithAuth = async <T = any,>(name: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("Sessão expirada. Saia e entre novamente no Super Admin.");
    }
    return supabase.functions.invoke<T>(name, {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
  };

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

  // Auto-sync real status from Evolution on mount (evita status "connecting" travado)
  useEffect(() => {
    (async () => {
      try {
        await invokeWithAuth("platform-whatsapp-sync-status", {});
        qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
      } catch {
        /* silencioso */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime — reflete conexão/desconexão instantaneamente
  useEffect(() => {
    const forceSync = async () => {
      try { await invokeWithAuth("platform-whatsapp-sync-status", {}); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
    };
    const channel = supabase
      .channel("platform-wa-cfg-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_whatsapp_config" },
        () => qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") forceSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

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
      const { data, error } = await invokeWithAuth("evolution-qr-code", {
        instance_name: cfg?.instance_name || "itasuper-platform", is_platform: true,
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      const qr = (data as any)?.qr_base64 || (data as any)?.qr_code || (data as any)?.base64 || null;
      if (!qr) throw new Error((data as any)?.error || "Evolution não retornou QR Code");
      setQrData(qr);
      toast({ title: "QR Code gerado" });
    } catch (e: any) {
      toast({ title: "Erro QR", description: e.message, variant: "destructive" });
      setFailCount((n) => n + 1);
    } finally { setQrLoading(false); }
  };

  const fetchPairing = async () => {
    const phone = pairingPhone.replace(/\D/g, "");
    if (phone.length < 10) return toast({ title: "Número inválido", description: "Formato: 5522999999999", variant: "destructive" });
    setPairingLoading(true); setPairingCode(null); setQrData(null); setPairingExpiresAt(null); setCopied(false);
    try {
      const { data, error } = await invokeWithAuth("evolution-qr-code", {
        instance_name: cfg?.instance_name || "itasuper-platform", is_platform: true, pairing_number: phone, force_reconnect: true,
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      const code = (data as any)?.pairing_code as string | null;
      if (!code) throw new Error("Evolution não retornou pairing code");
      setPairingCode(code);
      setPairingExpiresAt(Date.now() + 60_000);
      toast({ title: "Código gerado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
      setFailCount((n) => n + 1);
    } finally { setPairingLoading(false); }
  };

  const sendTest = async () => {
    const phone = testPhone.replace(/\D/g, "");
    if (phone.length < 10) return toast({ title: "Número inválido", variant: "destructive" });
    const { data, error } = await invokeWithAuth("platform-whatsapp-send", {
      phone, message: `Teste ItaSuper — ${new Date().toLocaleString("pt-BR")}`, kind: "test", force: true,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    if ((data as any)?.error) return toast({ title: "Falhou", description: (data as any).error, variant: "destructive" });
    toast({ title: "Enviado!" });
  };

  const statusColor = cfg?.status === "connected" ? "text-green-600" : "text-amber-600";

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-black">WhatsApp da Plataforma</h2>
          <p className="text-xs text-muted-foreground">Instância dedicada para avisar lojistas em nome da ItaSuper</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs font-bold ${statusColor}`}>● {cfg?.status || "?"}</span>
        </div>
      </div>

      <Tabs defaultValue="conexao" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="conexao"><LinkIcon className="h-3.5 w-3.5 mr-1" />Conexão</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" />Config.</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="space-y-4 mt-4">

      {cfg?.status === "connected" ? (
        <>
          <div className="rounded-2xl border-2 border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 shrink-0">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-black text-green-800 dark:text-green-300">WhatsApp conectado</div>
                <div className="text-xs text-green-700/80 dark:text-green-400/80">Pronto para enviar avisos aos lojistas</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/70 dark:bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Número</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                  <div className="text-sm font-bold truncate">
                    {cfg?.phone_number ? formatBrPhone(cfg.phone_number) || cfg.phone_number : "—"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Instância</div>
                <div className="text-sm font-mono font-bold mt-0.5 truncate">{cfg?.instance_name || "itasuper-platform"}</div>
              </div>
            </div>

            {cfg?.connected_at && (
              <div className="text-[11px] text-muted-foreground text-center">
                Conectado em {new Date(cfg.connected_at).toLocaleString("pt-BR")}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={async () => {
                  const { data, error } = await invokeWithAuth("platform-whatsapp-sync-status", {});
                  if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
                  toast({ title: "Status sincronizado", description: (data as any)?.status });
                  qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Desconectar o WhatsApp da plataforma? Você precisará parear novamente.")) return;
                  try {
                    const { error } = await invokeWithAuth("evolution-qr-code", {
                      instance_name: cfg?.instance_name || "itasuper-platform",
                      is_platform: true,
                      action: "logout",
                    });
                    if (error) throw new Error(await getFunctionErrorMessage(error));
                    toast({ title: "Desconectado" });
                    qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
                  } catch (e: any) {
                    toast({ title: "Erro", description: e.message, variant: "destructive" });
                  }
                }}
              >
                <Power className="h-4 w-4 mr-1" /> Desconectar
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-green-600" />
              <Label className="text-sm font-bold">Enviar mensagem de teste</Label>
            </div>
            <p className="text-xs text-muted-foreground">Envie uma mensagem para confirmar que tudo está funcionando.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5522999999999" inputMode="tel" className="flex-1" />
              <Button onClick={sendTest} className="bg-green-600 hover:bg-green-700 text-white">
                <Send className="h-4 w-4 mr-1" /> Enviar teste
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
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

        <div className="flex gap-2 flex-wrap">
          <Button onClick={fetchQr} disabled={qrLoading} variant="outline" size="sm">
            {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Gerar QR Code
          </Button>
          <Button
            onClick={async () => {
              const { data, error } = await invokeWithAuth("platform-whatsapp-sync-status", {});
              if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
              if ((data as any)?.error) return toast({ title: "Erro", description: (data as any).error, variant: "destructive" });
              toast({ title: "Status sincronizado", description: (data as any)?.status });
              qc.invalidateQueries({ queryKey: ["platform-wa-cfg"] });
            }}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className="h-4 w-4" /> Sincronizar status
          </Button>
        </div>

        {qrData && (
          <div className="p-3 bg-white rounded-lg flex justify-center">
            <img src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`} alt="QR" className="max-w-[280px]" />
          </div>
        )}
      </div>

      <PasskeyWarning highlight={failCount >= 2} />

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-green-600" />
          <div className="font-bold">Conectar por número de telefone</div>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
          <li>Digite o número do WhatsApp abaixo e toque em <b>Gerar código</b>.</li>
          <li>No celular, abra <b>WhatsApp → Aparelhos conectados → Conectar aparelho</b>.</li>
          <li>Toque em <b>Conectar com número de telefone</b> e digite o código gerado.</li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={pairingPhone}
            onChange={(e) => setPairingPhone(formatBrPhone(e.target.value))}
            placeholder="+55 (22) 99999-9999"
            inputMode="tel"
            maxLength={20}
            className="flex-1"
          />
          <Button onClick={fetchPairing} disabled={pairingLoading} className="bg-green-600 hover:bg-green-700 text-white">
            {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Smartphone className="h-4 w-4 mr-1" />}
            Gerar código
          </Button>
        </div>

        {pairingCode && (() => {
          const clean = pairingCode.replace(/[^A-Z0-9]/gi, "").toUpperCase();
          const g1 = clean.slice(0, 4).split("");
          const g2 = clean.slice(4, 8).split("");
          const expired = secondsLeft <= 0;
          return (
            <div className={`p-4 rounded-xl border-2 border-dashed space-y-3 ${expired ? "bg-muted border-muted-foreground/30" : "bg-green-50 dark:bg-green-950/30 border-green-500/40"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Digite este código no WhatsApp
                </div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${expired ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"}`}>
                  {expired ? "Expirado" : `${secondsLeft}s`}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                {g1.map((c, i) => (
                  <div key={`a${i}`} className={`w-9 h-12 sm:w-11 sm:h-14 rounded-lg flex items-center justify-center text-2xl sm:text-3xl font-black font-mono ${expired ? "bg-background text-muted-foreground" : "bg-white dark:bg-background text-green-700 dark:text-green-400 shadow-sm"}`}>{c}</div>
                ))}
                <div className="text-2xl font-black text-muted-foreground px-1">–</div>
                {g2.map((c, i) => (
                  <div key={`b${i}`} className={`w-9 h-12 sm:w-11 sm:h-14 rounded-lg flex items-center justify-center text-2xl sm:text-3xl font-black font-mono ${expired ? "bg-background text-muted-foreground" : "bg-white dark:bg-background text-green-700 dark:text-green-400 shadow-sm"}`}>{c}</div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(clean).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  disabled={expired}
                >
                  {copied ? <><Check className="h-4 w-4 mr-1" />Copiado</> : <><Copy className="h-4 w-4 mr-1" />Copiar código</>}
                </Button>
                {expired && (
                  <Button size="sm" className="flex-1" onClick={fetchPairing} disabled={pairingLoading}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Gerar novo
                  </Button>
                )}
              </div>

              <div className="text-[11px] text-center text-muted-foreground">
                {expired ? "O código expirou. Gere um novo e digite rapidamente." : "Digite no WhatsApp antes de expirar."}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Label className="text-sm font-bold">Testar envio</Label>
        <div className="flex gap-2">
          <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5522..." />
          <Button onClick={sendTest} disabled={cfg?.status !== "connected"}>
            <Send className="h-4 w-4 mr-1" /> Enviar
          </Button>
        </div>
      </div>
        </>
      )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <PlatformWhatsAppHistory />
        </TabsContent>

        <TabsContent value="config" className="space-y-4 mt-4">

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

        </TabsContent>
      </Tabs>
    </div>
  );
}