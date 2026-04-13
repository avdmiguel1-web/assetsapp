import { DEFAULT_DEVICE_ID as DEVICE_ID } from "../services/flespiService";
import { useState } from "react";
import { useApp } from "../stores/AppContext";
import { useTelemetry } from "../hooks/useTelemetry";
import FleetMap from "../components/fleet/FleetMap";
import { Truck, Radio, MapPin } from "lucide-react";

const COUNTRY_FLAGS = { Venezuela: "🇻🇪", Colombia: "🇨🇴", "Estados Unidos": "🇺🇸" };
const STATUS_BADGE = { Operativo: "badge-green", Mantenimiento: "badge-amber", Baja: "badge-red" };

export default function FleetPage() {
  const { assets } = useApp();
  const { telemetry, loading, error } = useTelemetry(15000);
  const [selectedCountry, setSelectedCountry] = useState("");

  const fleetAssets = assets.filter((a) => a.category === "Vehículos (Flota)");
  const gpsAssets = assets.filter((a) => a.hasTelemetry);
  const filteredFleet = selectedCountry
    ? fleetAssets.filter((a) => a.country === selectedCountry)
    : fleetAssets;

  const ignOn = telemetry?.ignitionOn;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Flota & Rastreo GPS</h1>
          <p className="page-subtitle">Mapa en vivo · ST-901 · {fleetAssets.length} vehículos en flota</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {["Venezuela", "Colombia", "Estados Unidos"].map((c) => (
            <button key={c} className={`btn ${selectedCountry === c ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setSelectedCountry(selectedCountry === c ? "" : c)}>
              {COUNTRY_FLAGS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      {/* DEVICE STATUS BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Radio size={16} color="var(--accent-blue)" />
            <span style={{ fontWeight: 700, fontSize: 13 }}>SINOTRACKER ST-901</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "var(--text-muted)" }}>ID: {DEVICE_ID}</span>
          </div>
          {loading && !telemetry ? (
            <div className="telemetry-live"><div className="spinner" style={{ width: 14, height: 14 }} /> Conectando...</div>
          ) : error ? (
            <span style={{ fontSize: 12, color: "var(--accent-red)" }}>⚠ {error}</span>
          ) : telemetry ? (
            <>
              <div className="telemetry-live"><div className="pulse-dot" /> LIVE</div>
              <span className={ignOn ? "ignition-on" : "ignition-off"} style={{ fontSize: 12 }}>
                <div className={`pulse-dot ${!ignOn ? "offline" : ""}`} />
                Motor {ignOn ? "ENCENDIDO" : "APAGADO"}
              </span>
              {telemetry.speed != null && (
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--text-secondary)" }}>
                  {Math.round(telemetry.speed)} km/h
                </span>
              )}
              {telemetry.latitude && (
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "var(--accent-blue)" }}>
                  <MapPin size={12} style={{ display: "inline", marginRight: 3 }} />
                  {telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)}
                </span>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* MAP */}
      <div style={{ marginBottom: 24 }}>
        <FleetMap telemetry={telemetry} height={460} />
      </div>

      {/* FLEET TABLE */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🚛 Vehículos de Flota {selectedCountry ? `· ${COUNTRY_FLAGS[selectedCountry]} ${selectedCountry}` : ""}</span>
          <span className="badge badge-blue">{filteredFleet.length} unidades</span>
        </div>

        {filteredFleet.length === 0 ? (
          <div className="empty-state">
            <Truck size={36} />
            <p>{fleetAssets.length === 0
              ? "No hay vehículos en flota. Registra activos con categoría «Vehículos (Flota)»."
              : "No hay vehículos en este país."
            }</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Vehículo</th>
                  <th>Placa</th>
                  <th>Estado</th>
                  <th>País / Almacén</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {filteredFleet.map((a) => {
                  const isLive = a.hasTelemetry && String(a.flespiDeviceId) === "7813187";
                  return (
                    <tr key={a.id}>
                      <td className="mono">{a.id}</td>
                      <td className="primary">{a.brand} {a.model}</td>
                      <td style={{ fontFamily: "JetBrains Mono", fontSize: 11 }}>{a.plate || "—"}</td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] || "badge-muted"}`}>{a.status}</span></td>
                      <td style={{ fontSize: 12 }}>{COUNTRY_FLAGS[a.country]} {a.country} · {a.warehouse}</td>
                      <td>
                        {a.hasTelemetry ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="badge badge-blue">GPS</span>
                            {isLive && telemetry?.latitude && (
                              <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--accent-green)" }}>
                                {telemetry.latitude.toFixed(3)}, {telemetry.longitude.toFixed(3)}
                              </span>
                            )}
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Sin GPS</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
