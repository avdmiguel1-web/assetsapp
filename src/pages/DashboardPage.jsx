import { useState, useMemo, useEffect } from "react";
import { useApp } from "../stores/AppContext";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import AssetDetailModal from "../components/inventory/AssetDetailModalFixed";
import AssetModal from "../components/inventory/AssetModal";
import BulkImportModal from "../components/inventory/BulkImportModal";
import ResolvedImage from "../components/common/ResolvedImage";
import { Package, Activity, AlertTriangle, MapPin, Search, X, Eye, Pencil, Trash2, Globe, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { buildAssetExportRows, downloadSpreadsheetXml } from "../lib/spreadsheet";

const STATUS_BADGE = { Operativo: "badge-green", Mantenimiento: "badge-amber", Baja: "badge-red" };
const PAGE_SIZE = 10;

function StatCard({ label, value, sub, color, icon: Icon, active, onClick }) {
  const accent = { green: "green", amber: "amber", red: "red", purple: "purple" };
  return (
    <div
      className={`stat-card ${color}`}
      onClick={onClick}
      style={{
        cursor: "pointer",
        outline: active ? `2px solid var(--accent-${accent[color] || "blue"})` : "none",
        outlineOffset: 2,
        transform: active ? "translateY(-2px)" : undefined,
        boxShadow: active ? "var(--shadow-lg)" : undefined,
      }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-icon-wrap"><Icon size={44} /></div>
    </div>
  );
}

const KPI_FILTERS = {
  all: () => true,
  operative: (a) => a.status === "Operativo",
  maintenance: (a) => a.status === "Mantenimiento",
  baja: (a) => a.status === "Baja",
  gps: (a) => a.hasTelemetry,
};

export default function DashboardPage({ detailAssetId, onOpenAssetDetail, onCloseAssetDetail }) {
  const t = useT();
  const { canDo } = useAuth();
  const { assets, countries, locations, CATEGORIES, deleteAsset, FLAG_MAP } = useApp();
  const [kpiFilter, setKpiFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [localDetailAssetId, setLocalDetailAssetId] = useState(null);
  const [editAsset, setEditAsset] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const resolvedDetailAssetId = detailAssetId ?? localDetailAssetId;
  const openAssetDetail = onOpenAssetDetail ?? ((assetId) => setLocalDetailAssetId(assetId));
  const closeAssetDetail = onCloseAssetDetail ?? (() => setLocalDetailAssetId(null));
  const detailAsset = useMemo(
    () => assets.find((asset) => asset.id === resolvedDetailAssetId) || null,
    [assets, resolvedDetailAssetId]
  );

  const total = assets.length;
  const operative = assets.filter((a) => a.status === "Operativo").length;
  const maintenance = assets.filter((a) => a.status === "Mantenimiento").length;
  const baja = assets.filter((a) => a.status === "Baja").length;
  const withGps = assets.filter((a) => a.hasTelemetry).length;

  const tabs = ["all", ...countries];
  const countByCountry = (country) => assets.filter((a) => a.country === country).length;
  const locationLookup = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );
  const locationOptions = useMemo(
    () => [...new Set(locations.map((location) => location.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [locations]
  );

  const handleKpi = (key) => {
    setKpiFilter((current) => (current === key ? "all" : key));
    setActiveTab("all");
    setSearch("");
    setFilterCat("");
    setFilterStatus("");
    setFilterLocation("");
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets
      .filter((asset) => {
        if (!KPI_FILTERS[kpiFilter]?.(asset)) return false;
        if (activeTab !== "all" && asset.country !== activeTab) return false;
        if (filterCat && asset.category !== filterCat) return false;
        if (filterStatus && asset.status !== filterStatus) return false;
        if (filterLocation && asset.location !== filterLocation) return false;
        const linkedLocation = locationLookup.get(asset.locationId) || locations.find((location) => location.name === asset.location && location.country === asset.country);
        if (q && !`${asset.brand} ${asset.model} ${asset.plate} ${asset.assetId} ${asset.id} ${asset.location} ${linkedLocation?.address || ""} ${linkedLocation?.description || ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      // Ordenamiento alfabético A-Z por nombre del activo (brand + model)
      .sort((a, b) => {
        const nameA = `${a.brand} ${a.model}`.toLowerCase();
        const nameB = `${b.brand} ${b.model}`.toLowerCase();
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      });
  }, [assets, activeTab, filterCat, filterLocation, filterStatus, kpiFilter, locationLookup, locations, search]);

  useEffect(() => {
    setPage(1);
  }, [kpiFilter, activeTab, search, filterCat, filterStatus, filterLocation]);

  useEffect(() => {
    if (resolvedDetailAssetId && !detailAsset) {
      closeAssetDetail();
    }
  }, [closeAssetDetail, detailAsset, resolvedDetailAssetId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [currentPage, filtered]);

  const handleDelete = (event, asset) => {
    event.stopPropagation();
    const message = t.lang === "en"
      ? `Delete "${asset.brand} ${asset.model}"?\nThis action cannot be undone.`
      : `Eliminar "${asset.brand} ${asset.model}"?\nEsta accion no se puede deshacer.`;

    if (window.confirm(message)) {
      deleteAsset(asset.id);
      if (detailAsset?.id === asset.id) closeAssetDetail();
    }
  };

  const clearAll = () => {
    setKpiFilter("all");
    setSearch("");
    setFilterCat("");
    setFilterStatus("");
    setFilterLocation("");
  };

  const hasActiveFilter = kpiFilter !== "all" || search || filterCat || filterStatus || filterLocation;

  const kpiLabel = {
    all: "",
    operative: t.dashboard.operative,
    maintenance: t.dashboard.maintenance,
    baja: t.dashboard.lowBaja,
    gps: t.dashboard.withGps,
  };

  const statusOptions = [
    { key: "Operativo", label: t.statuses.Operativo },
    { key: "Mantenimiento", label: t.statuses.Mantenimiento },
    { key: "Baja", label: t.statuses.Baja },
  ];

  const exportAssets = () => {
    downloadSpreadsheetXml("Dashboard-Activos.xml", [
      {
        name: "Activos",
        rows: buildAssetExportRows(filtered),
      },
    ]);
  };

  const exportSelectedKpi = () => {
    if (kpiFilter === "all") return;

    downloadSpreadsheetXml(`dashboard-${kpiFilter}.xml`, [
      {
        name: "Resumen KPI",
        rows: [
          ["FILTRO KPI", kpiLabel[kpiFilter] || kpiFilter],
          ["TOTAL ACTIVOS", String(filtered.length)],
          ["PAIS ACTIVO", activeTab === "all" ? (t.lang === "en" ? "ALL" : "TODOS") : activeTab],
          ["CATEGORIA FILTRADA", filterCat || (t.lang === "en" ? "ALL" : "TODAS")],
          ["ESTADO FILTRADO", filterStatus || (t.lang === "en" ? "ALL" : "TODOS")],
          ["BUSQUEDA", search || ""],
        ],
      },
      {
        name: "Activos Filtrados",
        rows: buildAssetExportRows(filtered),
      },
    ]);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.dashboard.title}</h1>
          <p className="page-subtitle">
            {total === 0 ? t.dashboard.subtitle_empty : t.dashboard.subtitle(total)}
          </p>
        </div>
        {canDo("asset_create") && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> {t.dashboard.bulkImport || "Carga Masiva"}
            </button>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              {t.dashboard.registerAsset}
            </button>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
          <StatCard label={t.dashboard.operative} value={operative} sub={`${Math.round((operative / total) * 100)}%`} color="green" icon={Activity} active={kpiFilter === "operative"} onClick={() => handleKpi("operative")} />
          <StatCard label={t.dashboard.maintenance} value={maintenance} sub={t.dashboard.maintenanceSub || ""} color="amber" icon={AlertTriangle} active={kpiFilter === "maintenance"} onClick={() => handleKpi("maintenance")} />
          <StatCard label={t.dashboard.lowBaja} value={baja} sub={t.dashboard.bajaSub || ""} color="red" icon={AlertTriangle} active={kpiFilter === "baja"} onClick={() => handleKpi("baja")} />
          <StatCard label={t.dashboard.withGps} value={withGps} sub={t.dashboard.gpsSub || ""} color="purple" icon={MapPin} active={kpiFilter === "gps"} onClick={() => handleKpi("gps")} />
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {total > 0 && (
          <div style={{ borderBottom: "1px solid var(--border-subtle)", padding: "0 20px", background: "var(--)", display: "flex", alignItems: "center", gap: 2, overflowX: "auto" }}>
            {tabs.map((tab) => {
              const isAll = tab === "all";
              const count = isAll ? total : countByCountry(tab);
              const active = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setKpiFilter("all");
                    setSearch("");
                    setFilterCat("");
                    setFilterStatus("");
                    setFilterLocation("");
                  }}
                  style={{
                    padding: "12px 16px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                    borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
                    whiteSpace: "nowrap",
                    transition: "var(--transition)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: -1,
                  }}
                >
                  {isAll ? <Globe size={13} /> : (FLAG_MAP[tab] && <span>{FLAG_MAP[tab]}</span>)}
                  {isAll ? t.dashboard.allCountries : tab}
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, background: active ? "var(--accent-blue-light)" : "var(--bg-hover)", color: active ? "var(--accent-blue)" : "var(--text-muted)", padding: "1px 7px", borderRadius: 20 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {kpiFilter !== "all" && (
              <span
                className={`badge ${kpiFilter === "operative" ? "badge-green" : kpiFilter === "maintenance" ? "badge-amber" : kpiFilter === "baja" ? "badge-red" : "badge-purple"}`}
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => setKpiFilter("all")}
              >
                {kpiLabel[kpiFilter]} <X size={10} style={{ marginLeft: 3 }} />
              </span>
            )}
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <Search size={14} color="var(--text-muted)" />
              <input placeholder={t.dashboard.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}><X size={12} /></button>}
            </div>
            <select className="form-select" style={{ width: "auto", fontSize: 12 }} value={filterCat} onChange={(event) => setFilterCat(event.target.value)}>
              <option value="">{t.dashboard.allCategories}</option>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <select className="form-select" style={{ width: "auto", fontSize: 12 }} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              <option value="">{t.dashboard.allStatuses}</option>
              {statusOptions.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
            </select>
            <select className="form-select" style={{ width: "auto", fontSize: 12 }} value={filterLocation} onChange={(event) => setFilterLocation(event.target.value)}>
              <option value="">{t.dashboard.allLocations || "Todas las ubicaciones"}</option>
              {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
            {hasActiveFilter && (
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--accent-red)" }} onClick={clearAll}>
                <X size={12} /> {t.dashboard.clear}
              </button>
            )}
            {kpiFilter !== "all" && (
              <button className="btn btn-secondary btn-sm" onClick={exportSelectedKpi}>
                <Download size={12} /> {t.dashboard.exportSelected || "Exportar filtro seleccionado"}
              </button>
            )}
            {filtered.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={exportAssets}>
                <Download size={12} /> {t.dashboard.exportAssets || "Exportar activos"}
              </button>
            )}
          </div>
        )}

        {total === 0 ? (
          <div className="empty-state" style={{ padding: "80px 24px" }}>
            <Package size={52} color="var(--accent-blue)" style={{ opacity: 0.25 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{t.dashboard.noAssets}</p>
            <p style={{ maxWidth: 320 }}>{t.dashboard.noAssetsSub}</p>
            {canDo("asset_create") && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
                  <Upload size={14} /> {t.dashboard.bulkImport || "Carga Masiva"}
                </button>
                <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  {t.dashboard.registerFirst}
                </button>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <Search size={28} style={{ opacity: 0.3 }} />
            <p>{t.dashboard.noResults}</p>
            <button className="btn btn-secondary btn-sm" onClick={clearAll}>{t.dashboard.clearFilters}</button>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    {[
                      { l: t.dashboard.asset, hide: false },
                      { l: t.dashboard.plate, hide: true },
                      { l: t.dashboard.category, hide: true },
                      { l: t.dashboard.country, hide: true },
                      { l: t.dashboard.location, hide: false },
                      { l: t.dashboard.status, hide: false },
                      { l: t.dashboard.gps, hide: true },
                      { l: t.dashboard.actions, hide: false },
                    ].map(({ l, hide }, index) => (
                      <th key={l} className={hide ? "col-hide-mobile" : ""} style={{ padding: "10px 16px", textAlign: index === 7 ? "right" : "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap", borderBottom: "1px solid var(--border-subtle)" }}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => openAssetDetail(asset.id)}
                      style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", transition: "background 0.12s" }}
                      onMouseOver={(event) => { event.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseOut={(event) => { event.currentTarget.style.background = ""; }}
                    >
                      <td style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {asset.profilePhoto
                            ? <ResolvedImage src={asset.profilePhoto} alternateSrc={asset.profilePhotoSource} alt="" style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border-subtle)" }} />
                            : <div style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Package size={15} color="var(--text-muted)" style={{ opacity: 0.4 }} /></div>}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{asset.brand} {asset.model}</div>
                            <div style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--accent-amber)" }}>{asset.assetId || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "11px 16px", verticalAlign: "middle" }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{asset.plate || "—"}</span></td>
                      <td className="col-hide-mobile" style={{ padding: "11px 16px", verticalAlign: "middle" }}><span className="badge badge-muted" style={{ fontSize: 10 }}>{asset.category}</span></td>
                      <td style={{ padding: "11px 16px", verticalAlign: "middle", fontSize: 13 }}>
                        <div>{FLAG_MAP[asset.country] || ""} {asset.country}</div>
                        {asset.location && (
                          <div className="location-mobile-only" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {asset.location}
                          </div>
                        )}
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "11px 16px", verticalAlign: "middle", fontSize: 12, color: "var(--text-secondary)" }}>{asset.location || "—"}</td>
                      <td style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                        <span className={`badge ${STATUS_BADGE[asset.status] || "badge-muted"}`}>
                          {t.statuses[asset.status] || asset.status}
                        </span>
                      </td>
                      <td className="col-hide-mobile" style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                        {asset.hasTelemetry ? <span className="badge badge-blue" style={{ fontSize: 10 }}>GPS</span> : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 16px", verticalAlign: "middle", textAlign: "right" }} onClick={(event) => event.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {canDo("asset_view_detail") && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-blue)" }} onClick={() => openAssetDetail(asset.id)}><Eye size={14} /></button>}
                          {canDo("asset_edit") && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditAsset(asset)}><Pencil size={14} /></button>}
                          {canDo("asset_delete") && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-red)" }} onClick={(event) => handleDelete(event, asset)}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t.lang === "en"
                  ? `Showing ${paginated.length} of ${filtered.length} assets`
                  : `Mostrando ${paginated.length} de ${filtered.length} activos`}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={13} /> {t.lang === "en" ? "Previous" : "Anterior"}
                </button>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 90, textAlign: "center" }}>
                  {t.lang === "en" ? `Page ${currentPage} / ${totalPages}` : `Pagina ${currentPage} / ${totalPages}`}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>
                  {t.lang === "en" ? "Next" : "Siguiente"} <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AssetModal open={addOpen} onClose={() => setAddOpen(false)} />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      {editAsset && <AssetModal open onClose={() => setEditAsset(null)} editAsset={editAsset} />}
      {detailAsset && (
        <AssetDetailModal
          open
          onClose={closeAssetDetail}
          asset={detailAsset}
          onEdit={() => {
            setEditAsset(detailAsset);
            closeAssetDetail();
          }}
        />
      )}
    </div>
  );
}
