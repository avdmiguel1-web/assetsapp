import { useState, useMemo } from "react";
import { useApp } from "../stores/AppContext";
import { useTelemetry } from "../hooks/useTelemetry";
import { DEFAULT_DEVICE_ID as DEVICE_ID } from "../services/flespiService";
import AssetModal from "../components/inventory/AssetModal";
import AssetDetailModal from "../components/inventory/AssetDetailModalFixed";
import ResolvedImage from "../components/common/ResolvedImage";
import { Plus, Search, X, Pencil, Eye, Trash2, Package, Filter } from "lucide-react";

const FLAGS  = { Venezuela:"🇻🇪", Colombia:"🇨🇴", "Estados Unidos":"🇺🇸" };
const STATUS_BADGE = { Operativo:"badge-green", Mantenimiento:"badge-amber", Baja:"badge-red" };

export default function InventoryPage() {
  const { assets, deleteAsset, CATEGORIES, STATUSES, COUNTRIES } = useApp();
  const { telemetry: t } = useTelemetry(30000);

  const [addOpen,     setAddOpen]     = useState(false);
  const [editAsset,   setEditAsset]   = useState(null);
  const [detailAsset, setDetailAsset] = useState(null);
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState("");
  const [filterStatus,setFilterStatus]= useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets.filter(a => {
      if (filterCat    && a.category !== filterCat)   return false;
      if (filterStatus && a.status   !== filterStatus) return false;
      if (q && !`${a.brand} ${a.model} ${a.plate} ${a.assetId} ${a.id} ${a.location} ${a.country}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [assets, search, filterCat, filterStatus]);

  const confirmDelete = (asset) => {
    if (window.confirm(`¿Eliminar "${asset.brand} ${asset.model}"? Esta acción no se puede deshacer.`)) {
      deleteAsset(asset.id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">{assets.length} activo{assets.length !== 1 ? "s" : ""} registrado{assets.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Registrar Activo
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <div className="search-bar" style={{ flex:1, minWidth:220 }}>
            <Search size={14} color="var(--text-muted)" />
            <input placeholder="Buscar por marca, modelo, placa, ID, ubicación..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}><X size={12} /></button>}
          </div>
          <select className="form-select" style={{ width:"auto" }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-select" style={{ width:"auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || filterCat || filterStatus) && (
            <button className="btn btn-ghost btn-sm" style={{ color:"var(--accent-red)" }}
              onClick={() => { setSearch(""); setFilterCat(""); setFilterStatus(""); }}>
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {assets.length === 0 ? (
        <div className="card" style={{ border:"2px dashed var(--border-default)", boxShadow:"none" }}>
          <div className="empty-state" style={{ padding:"60px 24px" }}>
            <Package size={48} color="var(--accent-blue)" style={{ opacity:0.3 }} />
            <p style={{ fontSize:15, fontWeight:600, color:"var(--text-secondary)" }}>No hay activos registrados</p>
            <p>Registra tu primer activo para comenzar a gestionar tu inventario.</p>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Registrar Primer Activo
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Activo</th>
                <th>Placa / Serial</th>
                <th>Categoría</th>
                <th>País</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>GPS</th>
                <th>Docs</th>
                <th style={{ textAlign:"right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => {
                const isLive = asset.hasTelemetry && String(asset.flespiDeviceId) === String(DEVICE_ID);
                return (
                  <tr key={asset.id} onClick={() => setDetailAsset(asset)}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {asset.profilePhoto ? (
                          <ResolvedImage src={asset.profilePhoto} alternateSrc={asset.profilePhotoSource} alt="" style={{ width:34, height:34, borderRadius:"var(--radius-sm)", objectFit:"cover", flexShrink:0, border:"1px solid var(--border-subtle)" }} />
                        ) : (
                          <div style={{ width:34, height:34, borderRadius:"var(--radius-sm)", background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <Package size={16} color="var(--text-muted)" style={{ opacity:0.4 }} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{asset.brand} {asset.model}</div>
                          <div className="mono" style={{ fontSize:10, color:"var(--text-muted)" }}>{asset.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono">{asset.plate || "—"}</span></td>
                    <td><span className="badge badge-muted" style={{ fontSize:10 }}>{asset.category}</span></td>
                    <td>{FLAGS[asset.country] || ""} {asset.country}</td>
                    <td style={{ color:"var(--text-secondary)", fontSize:12 }}>{asset.location || "—"}</td>
                    <td><span className={`badge ${STATUS_BADGE[asset.status]||"badge-muted"}`}>{asset.status}</span></td>
                    <td>
                      {isLive ? (
                        <span className={`badge ${t?.ignitionOn ? "badge-green" : "badge-red"}`} style={{ fontSize:10 }}>
                          {t?.ignitionOn ? "⚡ ON" : "● OFF"}
                        </span>
                      ) : asset.hasTelemetry ? (
                        <span className="badge badge-muted" style={{ fontSize:10 }}>🛰 GPS</span>
                      ) : (
                        <span style={{ color:"var(--text-muted)", fontSize:11 }}>—</span>
                      )}
                    </td>
                    <td>
                      {asset.files?.length > 0 ? (
                        <span className="badge badge-cyan" style={{ fontSize:10 }}>📎 {asset.files.length}</span>
                      ) : <span style={{ color:"var(--text-muted)", fontSize:11 }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Ver" style={{ color:"var(--accent-blue)" }} onClick={() => setDetailAsset(asset)}><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => setEditAsset(asset)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Eliminar" style={{ color:"var(--accent-red)" }} onClick={() => confirmDelete(asset)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding:24 }}>
              <Search size={28} />
              <p>Sin resultados para esa búsqueda.</p>
            </div>
          )}
        </div>
      )}

      <AssetModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editAsset   && <AssetModal open onClose={() => setEditAsset(null)} editAsset={editAsset} />}
      {detailAsset && <AssetDetailModal open onClose={() => setDetailAsset(null)} asset={detailAsset} onEdit={() => { setEditAsset(detailAsset); setDetailAsset(null); }} />}
    </div>
  );
}
