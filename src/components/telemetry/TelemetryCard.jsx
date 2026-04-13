import { useTelemetry } from "../../hooks/useTelemetry";
import DiagnosticPanel from "./DiagnosticPanel";
import { RefreshCw, WifiOff, Zap, ZapOff, MapPin, Clock, Satellite } from "lucide-react";
import { DEFAULT_DEVICE_ID as DEVICE_ID } from "../../services/flespiService";

function fmtTs(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("es-VE", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function Tile({ label, value, color = "blue" }) {
  const cfg = {
    blue:   ["var(--accent-blue)",   "var(--accent-blue-light)"],
    cyan:   ["var(--accent-cyan)",   "var(--accent-cyan-light)"],
    amber:  ["var(--accent-amber)",  "var(--accent-amber-light)"],
    purple: ["var(--accent-purple)", "var(--accent-purple-light)"],
    green:  ["var(--accent-green)",  "var(--accent-green-light)"],
    red:    ["var(--accent-red)",    "var(--accent-red-light)"],
  };
  const [fg, bg] = cfg[color] || cfg.blue;
  return (
    <div style={{ background:bg, borderRadius:"var(--radius-md)", padding:"10px 12px" }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", color:fg, textTransform:"uppercase", marginBottom:4, opacity:0.9 }}>{label}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:15, color:"var(--text-primary)", fontWeight:500 }}>{value ?? "—"}</div>
    </div>
  );
}

export default function TelemetryCard({ compact = false }) {
  const { telemetry: t, loading, error, lastUpdated, refresh } = useTelemetry(15000);

  return (
    <div className="card" style={{ padding:0, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 18px", background:"var(--bg-elevated)", borderBottom:"1px solid var(--border-subtle)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:"var(--radius-md)", background:"var(--accent-blue)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Satellite size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:13 }}>{t?.deviceName ?? "SINOTRACKER"} ST-901</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"var(--text-muted)" }}>
              ID: {t?.deviceId ?? DEVICE_ID}{t?.ident ? ` · ${t.ident}` : ""}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {loading && !t ? <div className="spinner" style={{ width:13, height:13 }} />
            : error ? <span style={{ fontSize:11, color:"var(--accent-red)", display:"flex", gap:4, alignItems:"center" }}><WifiOff size={11} /> Sin señal</span>
            : <div className="telemetry-live"><div className="pulse-dot" />LIVE</div>}
          <button className="btn btn-secondary btn-icon btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      <div style={{ padding:"14px 18px" }}>
        {error && (
          <>
            <div className="error-state" style={{ marginBottom:10 }}>{error}</div>
            <DiagnosticPanel />
          </>
        )}
        {loading && !t && !error && <div className="loading-state"><div className="spinner" /><span>Cargando telemetría...</span></div>}

        {t && !t.isEmpty && (
          <>
            {/* Motor status */}
            <div style={{
              display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
              background: t.ignitionOn ? "var(--accent-green-light)" : "var(--accent-red-light)",
              border: `1px solid ${t.ignitionOn ? "rgba(15,158,106,0.2)" : "rgba(220,38,38,0.2)"}`,
              borderRadius:"var(--radius-md)", marginBottom:10,
            }}>
              <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, background: t.ignitionOn ? "rgba(15,158,106,0.15)" : "rgba(220,38,38,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {t.ignitionOn ? <Zap size={19} color="var(--accent-green)" /> : <ZapOff size={19} color="var(--accent-red)" />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", color:"var(--text-muted)", textTransform:"uppercase", marginBottom:2 }}>engine.ignition.status</div>
                <div style={{ fontSize:17, fontWeight:800, color: t.ignitionOn ? "var(--accent-green)" : "var(--accent-red)" }}>
                  {t.ignitionOn ? "ENCENDIDO" : "APAGADO"}
                </div>
              </div>
              {t.batteryVoltage != null && (
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:"var(--accent-amber)", fontWeight:600 }}>🔋 {t.batteryVoltage}V</div>
                  {t.batteryLevel != null && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{t.batteryLevel}%</div>}
                </div>
              )}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginBottom:8 }}>
              <Tile label="position.speed"      value={t.speed != null ? `${t.speed} km/h` : "—"}      color="blue" />
              <Tile label="position.satellites" value={t.satellites != null ? `${t.satellites}` : "—"} color="cyan" />
              <Tile label="gsm.signal.dbm"      value={t.gsmSignalDbm != null ? `${t.gsmSignalDbm} dBm` : "—"} color="purple" />
            </div>

            {!compact && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                <Tile label="position.direction" value={t.direction != null ? `${t.direction}°` : "—"} color="blue" />
                <Tile label="position.valid"     value={t.posValid != null ? String(t.posValid) : "—"} color={t.posValid ? "green" : "red"} />
              </div>
            )}

            {t.hasPosition && (
              <div style={{ display:"flex", gap:8, alignItems:"center", padding:"8px 12px", background:"var(--accent-purple-light)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:"var(--radius-md)", marginBottom:8 }}>
                <MapPin size={12} color="var(--accent-purple)" style={{ flexShrink:0 }} />
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, flex:1 }}>
                  <span style={{ color:"var(--text-muted)", fontSize:9 }}>position.latitude / longitude</span><br />
                  <span style={{ color:"var(--text-primary)" }}>{t.latitude}, {t.longitude}</span>
                </div>
              </div>
            )}

            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"var(--text-muted)", display:"flex", gap:5, alignItems:"center" }}>
              <Clock size={10} /> timestamp: {fmtTs(t.timestamp)} · app: {lastUpdated?.toLocaleTimeString("es-VE") ?? "—"}
            </div>
          </>
        )}

        {t?.isEmpty && !error && !loading && (
          <p style={{ textAlign:"center", color:"var(--accent-amber)", fontSize:12, padding:"12px 0" }}>⚠ Sin mensajes disponibles.</p>
        )}
      </div>
    </div>
  );
}
