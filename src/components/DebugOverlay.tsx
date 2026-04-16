import { useState, useEffect, useRef } from "react";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// In-memory log buffer
const logBuffer: string[] = [];
const MAX_LOGS = 100;
let listeners: (() => void)[] = [];

function addLog(level: string, ...args: any[]) {
  const msg = `[${new Date().toLocaleTimeString()}] ${level}: ${args.map(a => {
    try { return typeof a === "object" ? JSON.stringify(a, null, 0) : String(a); }
    catch { return String(a); }
  }).join(" ")}`;
  logBuffer.push(msg);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  listeners.forEach(fn => fn());
}

// Patch console to capture logs
if (typeof window !== "undefined" && !(window as any).__debugPatched) {
  (window as any).__debugPatched = true;
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args) => { origLog(...args); addLog("LOG", ...args); };
  console.warn = (...args) => { origWarn(...args); addLog("WARN", ...args); };
  console.error = (...args) => { origError(...args); addLog("ERR", ...args); };

  window.addEventListener("error", (e) => {
    addLog("CRASH", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    addLog("CRASH", "Unhandled promise:", e.reason?.message || e.reason);
  });
}

// ── Test notification helpers ──

const sendTestPush = async (targetEmail: string, title: string, body: string) => {
  try {
    console.log(`[DebugTest] 🔔 Sending test push to ${targetEmail}: "${title}"`);

    // Look up user_id from profiles by email
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("email", targetEmail)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error(`[DebugTest] ❌ Profile not found for ${targetEmail}:`, profileErr?.message);
      return;
    }

    console.log(`[DebugTest] 📋 Found profile: ${profile.full_name} (${profile.user_id})`);

    // Check FCM tokens for this user
    const { data: tokens } = await supabase
      .from("fcm_tokens")
      .select("token, device_info, updated_at, user_id")
      .eq("user_id", profile.user_id);

    console.log(`[DebugTest] 📱 FCM tokens for ${targetEmail}:`, JSON.stringify(tokens?.map(t => ({
      user_id: t.user_id,
      device: t.device_info,
      token_prefix: t.token?.slice(0, 20) + "...",
      updated: t.updated_at
    }))));

    // Send push via edge function
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        user_ids: [profile.user_id],
        title,
        body,
        data: { link: "/pedidos", test: "true" }
      }
    });

    if (error) {
      console.error(`[DebugTest] ❌ send-push error:`, error);
    } else {
      console.log(`[DebugTest] ✅ send-push response:`, JSON.stringify(data));
    }
  } catch (e: any) {
    console.error(`[DebugTest] ❌ Exception:`, e.message);
  }
};

const sendTestToMotoboys = async () => {
  try {
    console.log(`[DebugTest] 🏍️ Sending test push to all active motoboys...`);

    const { data: drivers } = await supabase
      .from("drivers")
      .select("user_id, name, is_active")
      .eq("is_active", true);

    if (!drivers || drivers.length === 0) {
      console.warn(`[DebugTest] ⚠️ No active motoboys found`);
      return;
    }

    const userIds = drivers.map(d => d.user_id);
    console.log(`[DebugTest] 📋 Active motoboys (${drivers.length}):`, drivers.map(d => d.name).join(", "));

    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        user_ids: userIds,
        title: "🏍️ Teste — Nova Entrega!",
        body: "Esta é uma notificação de TESTE para motoboys.",
        data: { link: "/entregador", test: "true" }
      }
    });

    if (error) {
      console.error(`[DebugTest] ❌ send-push error:`, error);
    } else {
      console.log(`[DebugTest] ✅ send-push response:`, JSON.stringify(data));
    }
  } catch (e: any) {
    console.error(`[DebugTest] ❌ Exception:`, e.message);
  }
};

const checkCurrentDeviceTokens = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[DebugTest] ⚠️ No user logged in");
      return;
    }
    console.log(`[DebugTest] 👤 Current user: ${user.email} (${user.id})`);

    const { data: allTokens } = await supabase
      .from("fcm_tokens")
      .select("token, device_info, updated_at, user_id")
      .order("updated_at", { ascending: false })
      .limit(20);

    console.log(`[DebugTest] 📱 All recent FCM tokens in DB:`);
    allTokens?.forEach((t, i) => {
      console.log(`  [${i}] user=${t.user_id?.slice(0, 8)} device=${t.device_info} token=${t.token?.slice(0, 15)}... updated=${t.updated_at}`);
    });

    // Highlight tokens for current user
    const myTokens = allTokens?.filter(t => t.user_id === user.id);
    console.log(`[DebugTest] 🔑 Tokens for current user (${user.email}): ${myTokens?.length || 0}`);
  } catch (e: any) {
    console.error(`[DebugTest] ❌ Exception:`, e.message);
  }
};

// ── Component ──

const btnStyle: React.CSSProperties = {
  background: "#2563eb", color: "#fff", border: "none", borderRadius: 4,
  padding: "6px 10px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap"
};

const DebugOverlay = () => {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin via user_roles table
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
      });
  }, [user]);

  const shouldShow = isAdmin;

  useEffect(() => {
    if (!shouldShow) return;
    const update = () => setLogs([...logBuffer]);
    listeners.push(update);
    update();
    return () => { listeners = listeners.filter(fn => fn !== update); };
  }, [shouldShow]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, open]);

  if (!shouldShow) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 90, right: 10, zIndex: 999999,
          background: "#ef4444", color: "#fff", border: "none",
          borderRadius: "50%", width: 40, height: 40, fontSize: 18,
          fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
        }}
      >
        🐛
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999999,
      background: "rgba(0,0,0,0.95)", color: "#0f0",
      fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column"
    }}>
      <div style={{ padding: 8, borderBottom: "1px solid #333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontWeight: "bold", color: "#fff" }}>🐛 Debug Logs ({logs.length})</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { logBuffer.length = 0; setLogs([]); }}
              style={{ background: "#333", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}>
              Limpar
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background: "#333", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}>
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Test notification buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={btnStyle} onClick={() => sendTestPush(
            "vinivias13@gmail.com",
            "🧪 Teste — Pedido Preparando",
            "Notificação de TESTE para vinivias13."
          )}>
            📩 Push vinivias13
          </button>
          <button style={btnStyle} onClick={() => sendTestPush(
            "vinivias13@gmail.com",
            "🛵 Teste — Saiu para entrega!",
            "TESTE: Seu pedido saiu para entrega."
          )}>
            🛵 Entrega vinivias13
          </button>
          <button style={{ ...btnStyle, background: "#16a34a" }} onClick={sendTestToMotoboys}>
            🏍️ Push Motoboys
          </button>
          <button style={{ ...btnStyle, background: "#9333ea" }} onClick={checkCurrentDeviceTokens}>
            🔍 Ver Tokens
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 8 }}>
        {logs.length === 0 && <div style={{ color: "#666" }}>Nenhum log ainda...</div>}
        {logs.map((log, i) => (
          <div key={i} style={{
            padding: "2px 0", borderBottom: "1px solid #1a1a1a",
            color: log.includes("ERR") || log.includes("CRASH") ? "#f87171" :
                   log.includes("WARN") ? "#fbbf24" : "#4ade80",
            wordBreak: "break-all"
          }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebugOverlay;
