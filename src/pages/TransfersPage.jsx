import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../stores/AppContext";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import ResolvedImage from "../components/common/ResolvedImage";
import { ArrowRight, ArrowLeftRight, Plus, X, Package, MapPin, Search, AlertCircle } from "lucide-react";

function TransferModal({ open, onClose }) {
  const t = useT();
  const { assets, locations, transferAsset, FLAG_MAP } = useApp();
  const [assetId,      setAssetId]      = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [error,        setError]        = useState("");

  // Free-text search state for asset selection
  const [assetSearch,  setAssetSearch]  = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef  = useRef(null);
  const dropdownRef = useRef(null);

  const selectedAsset = assets.find(a => a.id === assetId) || null;
  const selectedDest  = locations.find(l => l.id === toLocationId) || null;
  const destOptions   = locations.filter(l => l.id !== selectedAsset?.locationId && l.name !== selectedAsset?.location);

  // Filter assets by free-text: assetId, brand, model
  const filteredAssets = useMemo(() => {
    const q = assetSearch.toLowerCase().trim();
    if (!q) return assets;
    return assets.filter(a =>
      (a.assetId && a.assetId.toLowerCase().includes(q)) ||
      (a.brand   && a.brand.toLowerCase().includes(q))   ||
      (a.model   && a.model.toLowerCase().includes(q))
    );
  }, [assets, assetSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current   && !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAsset = (asset) => {
    setAssetId(asset.id);
    setAssetSearch(`${asset.brand} ${asset.model}${asset.assetId ? ` · ${asset.assetId}` : ""}`);
    setToLocationId("");
    setError("");
    setShowDropdown(false);
  };

  const handleClearAsset = () => {
    setAssetId("");
    setAssetSearch("");
    setToLocationId("");
    setError("");
    setShowDropdown(false);
  };

  const handleTransfer = () => {
    if (!selectedAsset) { setError(t.transfers.errorAsset); return; }
    if (!selectedDest)  { setError(t.transfers.errorDest);  return; }
    transferAsset({
      assetId:        selectedAsset.id,
      toLocationId:   selectedDest.id,
      toLocationName: selectedDest.name,
      toCountry:      selectedDest.country,
    });
    onClose();
  };

  // Reset modal state when closing
  useEffect(() => {
    if (!open) {
      setAssetId("");
      setAssetSearch("");
      setToLocationId("");
      setError("");
      setShowDropdown(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{t.transfers.modalTitle}</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>{t.transfers.modalSub}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:18 }}>

          {/* ── Búsqueda libre de activo ── */}
          <div className="form-group">
            <label className="form-label">{t.transfers.modalTitle} *</label>
            {assets.length === 0 ? (
              <div style={{ fontSize:12, color:"var(--text-muted)", padding:"8px 12px", background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
                {t.transfers.noAssets}
              </div>
            ) : (
              <div style={{ position:"relative" }}>
                {/* Input de búsqueda */}
                <div
                  ref={searchRef}
                  className="search-bar"
                  style={{ margin:0, cursor:"text" }}
                  onClick={() => { if (!selectedAsset) setShowDropdown(true); }}
                >
                  <Search size={14} color="var(--text-muted)" style={{ flexShrink:0 }} />
                  <input
                    placeholder="Buscar por ID activo, marca o modelo…"
                    value={assetSearch}
                    readOnly={!!selectedAsset}
                    onChange={e => {
                      setAssetSearch(e.target.value);
                      setAssetId("");
                      setShowDropdown(true);
                    }}
                    onFocus={() => { if (!selectedAsset) setShowDropdown(true); }}
                    style={{ cursor: selectedAsset ? "default" : "text" }}
                  />
                  {(assetSearch || selectedAsset) && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={handleClearAsset}
                      title="Limpiar selección"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && !selectedAsset && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                      background:"var(--bg-surface)", border:"1px solid var(--border-default)",
                      borderRadius:"var(--radius-md)", boxShadow:"0 8px 24px rgba(0,0,0,0.15)",
                      zIndex:1000, maxHeight:220, overflowY:"auto"
                    }}
                  >
                    {filteredAssets.length === 0 ? (
                      <div style={{ padding:"12px 14px", fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>
                        Sin resultados
                      </div>
                    ) : (
                      filteredAssets.map(a => (
                        <div
                          key={a.id}
                          onClick={() => handleSelectAsset(a)}
                          style={{
                            display:"flex", alignItems:"center", gap:10,
                            padding:"10px 14px", cursor:"pointer",
                            borderBottom:"1px solid var(--border-subtle)",
                            transition:"background 0.12s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          {a.profilePhoto
                            ? <ResolvedImage src={a.profilePhoto} alternateSrc={a.profilePhotoSource} alt="" style={{ width:32, height:32, borderRadius:"var(--radius-sm)", objectFit:"cover", flexShrink:0 }} />
                            : <div style={{ width:32, height:32, borderRadius:"var(--radius-sm)", background:"var(--accent-blue-light)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Package size={15} color="var(--accent-blue)" /></div>
                          }
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {a.brand} {a.model}
                            </div>
                            <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", gap:6, marginTop:1, flexWrap:"wrap" }}>
                              {a.assetId  && <span style={{ fontFamily:"'IBM Plex Mono',monospace" }}>{a.assetId}</span>}
                              {a.plate    && <span>· {a.plate}</span>}
                              {a.location && <span>· {a.location}</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tarjeta del activo seleccionado ── */}
          {selectedAsset && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--bg-elevated)", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)" }}>
              {selectedAsset.profilePhoto
                ? <ResolvedImage src={selectedAsset.profilePhoto} alternateSrc={selectedAsset.profilePhotoSource} alt="" style={{ width:38, height:38, borderRadius:"var(--radius-sm)", objectFit:"cover", flexShrink:0 }} />
                : <div style={{ width:38, height:38, borderRadius:"var(--radius-sm)", background:"var(--accent-blue-light)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Package size={18} color="var(--accent-blue)" /></div>
              }
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{selectedAsset.brand} {selectedAsset.model}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                  <MapPin size={10} />
                  {t.transfers.currentLocation} <strong>{selectedAsset.location || "—"}</strong>
                  {selectedAsset.country && <span> · {FLAG_MAP[selectedAsset.country]||""} {selectedAsset.country}</span>}
                </div>
              </div>
            </div>
          )}

          {selectedAsset && (
            <div style={{ display:"flex", justifyContent:"center" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--accent-blue-light)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ArrowRight size={18} color="var(--accent-blue)" />
              </div>
            </div>
          )}

          {/* ── Destino ── */}
          <div className="form-group">
            <label className="form-label">{t.transfers.destination} *</label>
            {locations.length === 0 ? (
              <div style={{ fontSize:12, color:"var(--text-muted)", padding:"8px 12px", background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
                {t.transfers.noLocations}
              </div>
            ) : (
              <select className="form-select" value={toLocationId} onChange={e => { setToLocationId(e.target.value); setError(""); }} disabled={!selectedAsset}>
                <option value="">{t.transfers.selectDest}</option>
                {destOptions.map(l => (
                  <option key={l.id} value={l.id}>{FLAG_MAP[l.country]||""} {l.name} — {l.country}</option>
                ))}
              </select>
            )}
            {selectedAsset && destOptions.length === 0 && locations.length > 0 && (
              <span style={{ fontSize:11, color:"var(--accent-amber)", marginTop:4 }}>{t.transfers.sameLocation}</span>
            )}
          </div>

          {selectedDest && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--accent-green-light)", border:"1px solid rgba(15,158,106,0.2)", borderRadius:"var(--radius-md)" }}>
              <div style={{ fontSize:22 }}>{FLAG_MAP[selectedDest.country]||"📍"}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:"var(--accent-green)" }}>{selectedDest.name}</div>
                <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:1 }}>
                  {selectedDest.country}{selectedDest.address ? ` · ${selectedDest.address}` : ""}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ display:"flex", gap:6, alignItems:"center", color:"var(--accent-red)", fontSize:12 }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.transfers.cancel}</button>
          <button className="btn btn-primary" onClick={handleTransfer} disabled={!selectedAsset || !selectedDest}>
            <ArrowRight size={14} /> {t.transfers.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransfersPage() {
  const t = useT();
  const { transfers, assets, FLAG_MAP } = useApp();
  const { canDo } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [search,    setSearch]    = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return transfers.filter(tr => {
      const asset = assets.find(a => a.id === tr.assetId);
      if (!q) return true;
      return `${tr.fromLocation} ${tr.toLocation} ${tr.fromCountry} ${tr.toCountry} ${asset?.assetId || tr.assetId} ${asset?.brand || ""} ${asset?.model || ""}`.toLowerCase().includes(q);
    });
  }, [transfers, assets, search]);

  const enriched = filtered.map(tr => ({ ...tr, asset: assets.find(a => a.id === tr.assetId) }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.transfers.title}</h1>
          <p className="page-subtitle">{t.transfers.subtitle(transfers.length)}</p>
        </div>
        {canDo("transfer_create") && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> {t.transfers.newBtn}
          </button>
        )}
      </div>

      {transfers.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="search-bar">
            <Search size={14} color="var(--text-muted)" />
            <input
              placeholder="Buscar por ID activo, marca, modelo, origen, destino…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSearch("")}>
                <X size={12} />
              </button>
            )}
          </div>
          {search && (
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:8 }}>
              {filtered.length} traslado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="card" style={{ border:"2px dashed var(--border-default)", boxShadow:"none" }}>
          <div className="empty-state" style={{ padding:"60px 24px" }}>
            <ArrowLeftRight size={48} color="var(--accent-blue)" style={{ opacity:0.25 }} />
            <p style={{ fontSize:15, fontWeight:600, color:"var(--text-secondary)" }}>{t.transfers.noTransfers}</p>
            <p style={{ maxWidth:320 }}>{t.transfers.noTransfersSub}</p>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> {t.transfers.newBtn}
            </button>
          </div>
        </div>
      ) : enriched.length === 0 ? (
        <div className="card"><div className="empty-state"><Search size={28} style={{ opacity:0.3 }} /><p>{t.transfers.noResults}</p></div></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {enriched.map(tr => (
            <div key={tr.id} className="card" style={{ padding:"16px 20px" }}>
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                <div style={{ flexShrink:0 }}>
                  {tr.asset?.profilePhoto
                    ? <ResolvedImage src={tr.asset.profilePhoto} alternateSrc={tr.asset.profilePhotoSource} alt="" style={{ width:44, height:44, borderRadius:"var(--radius-md)", objectFit:"cover", border:"1px solid var(--border-subtle)" }} />
                    : <div style={{ width:44, height:44, borderRadius:"var(--radius-md)", background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center" }}><Package size={20} color="var(--text-muted)" style={{ opacity:0.4 }} /></div>
                  }
                </div>
                <div style={{ minWidth:140 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{tr.asset ? `${tr.asset.brand} ${tr.asset.model}` : tr.assetId}</div>
                  {tr.asset?.assetId && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{tr.asset.assetId}</div>}
                </div>
                <div style={{ flex:1, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, padding:"10px 14px", background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-default)" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{t.transfers.origin}</div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{FLAG_MAP[tr.fromCountry]||""} {tr.fromLocation || "—"}</div>
                    {tr.fromCountry && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{tr.fromCountry}</div>}
                  </div>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--accent-blue-light)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <ArrowRight size={14} color="var(--accent-blue)" />
                  </div>
                  <div style={{ flex:1, padding:"10px 14px", background:"var(--accent-green-light)", borderRadius:"var(--radius-md)", border:"1px solid rgba(15,158,106,0.2)" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"var(--accent-green)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{t.transfers.destination}</div>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--accent-green)" }}>{FLAG_MAP[tr.toCountry]||""} {tr.toLocation || "—"}</div>
                    {tr.toCountry && <div style={{ fontSize:11, color:"var(--text-secondary)" }}>{tr.toCountry}</div>}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                    {tr.ts ? new Date(tr.ts).toLocaleDateString("es-VE",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, color:"var(--text-primary)", marginTop:1 }}>
                    {tr.ts ? new Date(tr.ts).toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"}) : ""}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TransferModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
