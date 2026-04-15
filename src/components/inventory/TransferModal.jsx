import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useApp } from "../../stores/AppContext";

export default function TransferModal({ open, onClose, asset }) {
  const { transferAsset, COUNTRIES, WAREHOUSES } = useApp();
  const [toCountry, setToCountry] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [error, setError] = useState("");

  if (!open || !asset) return null;

  const warehouses = WAREHOUSES[toCountry] || [];

  const handleSubmit = () => {
    if (!toWarehouse) { setError("Selecciona un almacén de destino"); return; }
    if (toWarehouse === asset.warehouse && toCountry === asset.country) {
      setError("El destino es igual al origen");
      return;
    }
    transferAsset({ assetId: asset.id, toWarehouse, toCountry });
    setToCountry("");
    setToWarehouse("");
    setError("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Trasladar Activo</span>
          <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: 14, borderRadius: "var(--radius-md)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>ORIGEN</div>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{asset.brand} {asset.model}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{asset.warehouse} · {asset.country}</div>
            </div>
            <ArrowRight size={20} color="var(--accent-blue)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>DESTINO</div>
              <div style={{ fontWeight: 700, color: toWarehouse ? "var(--text-primary)" : "var(--text-muted)" }}>
                {toWarehouse || "—"}
              </div>
              {toCountry && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{toCountry}</div>}
            </div>
          </div>

          {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">País Destino</label>
              <select className="form-select" value={toCountry} onChange={(e) => { setToCountry(e.target.value); setToWarehouse(""); }}>
                <option value="">Seleccionar...</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Almacén Destino</label>
              <select className="form-select" value={toWarehouse} onChange={(e) => setToWarehouse(e.target.value)} disabled={!toCountry}>
                <option value="">Seleccionar...</option>
                {warehouses.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Confirmar Traslado</button>
        </div>
      </div>
    </div>
  );
}
