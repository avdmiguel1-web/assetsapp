import { useState } from "react";
import { runDiagnostic } from "../../services/flespiService";
import { Terminal, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const LABELS = {
  deviceInfo:    "📋 GET /gw/devices/7813187",
  latestMessage: "📡 GET /gw/devices/7813187/messages?count=1 (telemetría actual)",
  messages:      "💬 GET /gw/devices/7813187/messages (historial)",
};

export default function DiagnosticPanel() {
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(true);

  const run = async () => {
    setLoading(true); setResults(null);
    try { setResults(await runDiagnostic()); }
    catch (e) { setResults({ fatalError: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)", overflow: "hidden", marginTop: 10,
    }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 700, color: "var(--accent-amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <Terminal size={12} /> Diagnóstico API Flespi
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 10, padding: "4px 10px" }}
            onClick={e => { e.stopPropagation(); run(); }}
            disabled={loading}
          >
            <RefreshCw size={11} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            {loading ? "Probando..." : "Ejecutar test"}
          </button>
          {expanded ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 14 }}>
          {!results && !loading && (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Presiona «Ejecutar test» para verificar la conexión con Flespi.
            </p>
          )}
          {loading && <div className="loading-state" style={{ padding: 16 }}><div className="spinner" /><span>Probando endpoints...</span></div>}
          {results && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.fatalError && <div className="error-state">{results.fatalError}</div>}
              {results.endpoints && Object.entries(results.endpoints).map(([key, r]) => (
                <DiagRow key={key} label={LABELS[key] || key} result={r} />
              ))}
              {/* Show raw data from latest message if successful */}
              {results.endpoints?.latestMessage?.ok && results.endpoints.latestMessage.rawData && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Datos recibidos (último mensaje):
                  </div>
                  <pre style={{
                    fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--accent-green)",
                    background: "rgba(0,0,0,0.4)", padding: "10px 12px",
                    borderRadius: "var(--radius-sm)", overflowX: "auto", maxHeight: 280,
                    whiteSpace: "pre-wrap", border: "1px solid var(--border-subtle)",
                  }}>
                    {JSON.stringify(results.endpoints.latestMessage.rawData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagRow({ label, result }) {
  const ok = result?.ok;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
      background: ok ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
      border: `1px solid ${ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      borderRadius: "var(--radius-sm)",
    }}>
      {ok
        ? <CheckCircle size={14} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 1 }} />
        : <XCircle    size={14} color="var(--accent-red)"   style={{ flexShrink: 0, marginTop: 1 }} />
      }
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ok ? "var(--accent-green)" : "var(--accent-red)", marginBottom: ok ? 4 : 6 }}>
          {label} — {ok ? "✓ OK" : "✗ ERROR"}
        </div>
        {!ok && (
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "rgba(239,68,68,0.9)" }}>
            {result?.error}
          </div>
        )}
        {ok && (
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.8 }}>
            {result.deviceName  && `Nombre: ${result.deviceName} · ID: ${result.deviceId}`}
            {result.lat    != null && `Lat: ${result.lat}  Lng: ${result.lng}`}{"\n"}
            {result.ignition != null && `Motor: ${result.ignition ? "🟢 ENCENDIDO" : "🔴 APAGADO"} · `}
            {result.speed  != null && `Vel: ${result.speed} km/h · `}
            {result.battery != null && `Bat: ${result.battery}V`}{"\n"}
            {result.rawKeys != null && `${result.rawKeys} parámetros en el mensaje`}
            {result.count   != null && `${result.count} mensajes obtenidos`}
          </div>
        )}
        {ok && result?.isEmpty && (
          <div style={{ fontSize: 11, color: "var(--accent-amber)", marginTop: 4 }}>
            ⚠ El mensaje llegó vacío — el dispositivo puede no estar enviando datos
          </div>
        )}
      </div>
    </div>
  );
}
