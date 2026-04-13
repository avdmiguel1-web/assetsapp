import { useState } from "react";
import { useTelemetry, useMessages } from "../hooks/useTelemetry";
import FleetMap from "../components/fleet/FleetMap";
import DiagnosticPanel from "../components/telemetry/DiagnosticPanel";
import { DEFAULT_DEVICE_ID as DEVICE_ID } from "../services/flespiService";
import { RefreshCw, Zap, ZapOff, Navigation, Clock, WifiOff, Activity } from "lucide-react";

function fmtTs(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("es-VE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function KPI({ field, value, unit, color = "blue" }) {
  const cfg = {
    blue:   ["var(--accent-blue)",   "var(--accent-blue-dim)"],
    cyan:   ["var(--accent-cyan)",   "rgba(6,182,212,0.1)"],
    green:  ["var(--accent-green)",  "var(--accent-green-dim)"],
    red:    ["var(--accent-red)",    "var(--accent-red-dim)"],
    amber:  ["var(--accent-amber)",  "var(--accent-amber-dim)"],
    purple: ["var(--accent-purple)", "var(--accent-purple-dim)"],
  };
  const [fg, bg] = cfg[color] || cfg.blue;
  return (
    <div style={{ background: bg, borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: fg, textTransform: "uppercase", marginBottom: 8, opacity: 0.9 }}>
        {field}
      </div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 22, color: "var(--text-primary)", fontWeight: 500 }}>
        {value != null ? value : "—"}
        {unit && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function TelemetryPage() {
  const { telemetry: t, loading, error, lastUpdated, refresh } = useTelemetry(10000);
  const { messages, loading: msgLoading, error: msgError, ignitionEvents, reload } = useMessages();
  const [showRoute, setShowRoute] = useState(false);

  const routePoints = showRoute
    ? messages.filter(m => m.latitude && m.longitude).slice(-500)
    : [];

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Telemetría en Tiempo Real</h1>
          <p className="page-subtitle">
            {t?.deviceName ?? "ST-901"} · device.id: {t?.deviceId ?? DEVICE_ID}
            {t?.ident ? ` · ident: ${t.ident}` : ""}
            {!error && t && <span style={{ marginLeft: 10, color: "var(--accent-green)", fontWeight: 700 }}>● LIVE</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { refresh(); reload(); }} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            Actualizar
          </button>
          <button className={`btn btn-sm ${showRoute ? "btn-primary" : "btn-secondary"}`} onClick={() => setShowRoute(v => !v)}>
            <Navigation size={13} />
            {showRoute ? "Ocultar ruta" : "Ver ruta histórica"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-lg)", padding: "18px 20px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <WifiOff size={18} color="var(--accent-red)" />
              <span style={{ fontWeight: 800, color: "var(--accent-red)", fontSize: 14 }}>Error de conexión Flespi</span>
            </div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>
              {error}
            </div>
            <div style={{ fontSize: 12, color: "var(--accent-amber)", lineHeight: 1.8 }}>
              1. Detén el servidor → <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 3 }}>Ctrl+C</code><br />
              2. Vuelve a arrancar → <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 3 }}>npm run dev</code><br />
              3. Abre <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 3 }}>http://localhost:5174</code>
            </div>
          </div>
          <DiagnosticPanel />
        </div>
      )}

      {loading && !t && !error && (
        <div className="loading-state" style={{ padding: 60 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
          <span>Conectando con Flespi...</span>
        </div>
      )}

      {/* KPIs — todos los campos confirmados */}
      {t && !t.isEmpty && (
        <>
          {/* Motor — row completa */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "18px 22px", marginBottom: 16,
            background: t.ignitionOn ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${t.ignitionOn ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: "var(--radius-xl)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              background: t.ignitionOn ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {t.ignitionOn ? <Zap size={28} color="var(--accent-green)" /> : <ZapOff size={28} color="var(--accent-red)" />}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                engine.ignition.status
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: t.ignitionOn ? "var(--accent-green)" : "var(--accent-red)" }}>
                {t.ignitionOn ? "ENCENDIDO" : "APAGADO"}
              </div>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", textAlign: "right", lineHeight: 2 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>message.type: <strong style={{ color: "var(--text-primary)" }}>{t.messageType ?? "—"}</strong></div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>vendor.code: <strong style={{ color: "var(--text-primary)" }}>{t.vendorCode ?? "—"}</strong></div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>peer: <strong style={{ color: "var(--accent-cyan)", fontSize: 10 }}>{t.peer ?? "—"}</strong></div>
            </div>
          </div>

          {/* GPS + Speed + Sat */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            <KPI field="position.speed"      value={t.speed}       unit="km/h" color="blue" />
            <KPI field="position.satellites" value={t.satellites}  unit="sat"  color="cyan" />
            <KPI field="position.direction"  value={t.direction != null ? `${t.direction}°` : null} color="blue" />
          </div>

          {/* Battery + GSM */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <KPI field="battery.voltage"  value={t.batteryVoltage} unit="V"   color="amber" />
            <KPI field="battery.level"    value={t.batteryLevel}   unit="%"   color="amber" />
            <KPI field="gsm.signal.dbm"   value={t.gsmSignalDbm}   unit="dBm" color="purple" />
            <KPI field="position.valid"   value={t.posValid != null ? String(t.posValid) : null} color={t.posValid ? "green" : "red"} />
          </div>

          {/* GPS coords */}
          {t.hasPosition && (
            <div style={{
              fontFamily: "JetBrains Mono", fontSize: 13,
              background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 16,
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--accent-purple)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>POSITION.LATITUDE</div>
                <div style={{ color: "var(--text-primary)", fontSize: 16 }}>{t.latitude}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--accent-purple)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>POSITION.LONGITUDE</div>
                <div style={{ color: "var(--text-primary)", fontSize: 16 }}>{t.longitude}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--accent-purple)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>GSM NETWORK</div>
                <div style={{ color: "var(--text-primary)", fontSize: 13 }}>MCC:{t.gsmMcc} MNC:{t.gsmMnc}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Cell:{t.gsmCellId} LAC:{t.gsmLac}</div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--text-muted)", marginBottom: 20, display: "flex", gap: 6, alignItems: "center" }}>
            <Clock size={10} />
            timestamp: {fmtTs(t.timestamp)} ·
            server.timestamp: {fmtTs(t.serverTimestamp)} ·
            app actualizada: {lastUpdated?.toLocaleTimeString("es-VE") ?? "—"}
          </div>
        </>
      )}

      {/* MAP + RAW TABLE */}
      {!error && (
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 10 }}>📍 MAPA — position.latitude / position.longitude</div>
            <FleetMap telemetry={t} routePoints={routePoints} height={400} />
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-header">
              <span className="card-title">JSON CRUDO — Flespi /messages response</span>
              {t?.rawData && (
                <span className="badge badge-blue">{Object.keys(t.rawData).length} campos</span>
              )}
            </div>
            <div style={{ overflowY: "auto", maxHeight: 370 }}>
              {t?.rawData && Object.keys(t.rawData).length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th style={{ padding: "6px 12px", textAlign: "left", fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Campo</th>
                      <th style={{ padding: "6px 12px", textAlign: "right", fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(t.rawData)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, val]) => (
                        <tr key={key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "5px 12px", fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--accent-blue)" }}>{key}</td>
                          <td style={{ padding: "5px 12px", fontFamily: "JetBrains Mono", fontSize: 11, color: "var(--text-primary)", textAlign: "right" }}>
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>
                  <Activity size={28} /><p>Sin datos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EVENT LOG */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 LOG — engine.ignition.status</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {msgLoading && <div className="spinner" style={{ width: 13, height: 13 }} />}
            <span className="badge badge-muted">{ignitionEvents.length} cambios de estado</span>
            <span className="badge badge-blue">{messages.length} mensajes</span>
          </div>
        </div>

        {msgError && <div className="error-state" style={{ marginBottom: 12 }}>{msgError}</div>}

        {ignitionEvents.length === 0 && !msgLoading ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Clock size={28} /><p>Sin cambios de estado en el historial.</p>
          </div>
        ) : (
          <div className="event-log">
            {[...ignitionEvents].reverse().map((ev, i) => {
              const on = ev.status === true || ev.status === 1;
              return (
                <div key={i} className={`event-item ${on ? "ignition-on-event" : "ignition-off-event"}`}>
                  {on ? <Zap size={13} color="var(--accent-green)" /> : <ZapOff size={13} color="var(--accent-red)" />}
                  <div className="event-desc">
                    engine.ignition.status:{" "}
                    <strong style={{ color: on ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {on ? "true" : "false"}
                    </strong>
                    {ev.lat && (
                      <span style={{ marginLeft: 8, fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--text-muted)" }}>
                        @ {ev.lat.toFixed(5)}, {ev.lng?.toFixed(5)}
                      </span>
                    )}
                  </div>
                  <div className="event-time">{fmtTs(ev.timestamp)}</div>
                </div>
              );
            })}
          </div>
        )}

        {messages.length > 0 && (
          <>
            <div className="divider" />
            <div className="card-header" style={{ marginBottom: 8 }}>
              <span className="card-title">HISTORIAL GPS — últimos {Math.min(50, messages.length)} mensajes de {messages.length}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>timestamp</th>
                    <th>position.latitude</th>
                    <th>position.longitude</th>
                    <th>position.speed</th>
                    <th>battery.voltage</th>
                    <th>gsm.signal.dbm</th>
                    <th>engine.ignition</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.slice(0, 50).map((m, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 10 }}>{fmtTs(m.timestamp)}</td>
                      <td className="mono">{m.latitude?.toFixed(6) ?? "—"}</td>
                      <td className="mono">{m.longitude?.toFixed(6) ?? "—"}</td>
                      <td className="mono">{m.speed != null ? `${m.speed} km/h` : "—"}</td>
                      <td className="mono">{m.battery != null ? `${m.battery}V` : "—"}</td>
                      <td className="mono">{m.gsmSignal != null ? `${m.gsmSignal} dBm` : "—"}</td>
                      <td>
                        {m.ignition == null ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>—</span>
                          : (m.ignition === true || m.ignition === 1)
                            ? <span className="badge badge-green">true</span>
                            : <span className="badge badge-red">false</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
