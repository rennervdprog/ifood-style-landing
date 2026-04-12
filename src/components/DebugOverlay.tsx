import { useState, useEffect, useRef } from "react";
import { isCapacitorNative } from "@/lib/capacitorNative";

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

  // Catch unhandled errors
  window.addEventListener("error", (e) => {
    addLog("CRASH", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    addLog("CRASH", "Unhandled promise:", e.reason?.message || e.reason);
  });
}

const DebugOverlay = () => {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only show on Capacitor native or if ?debug=1
  const shouldShow = isCapacitorNative() || new URLSearchParams(window.location.search).has("debug");

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
      <div style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #333" }}>
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
