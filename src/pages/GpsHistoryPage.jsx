import { useState, useMemo, useEffect } from "react";
import { useApp } from "../stores/AppContext";
import { useMessages } from "../hooks/useTelemetry";
import { useT } from "../i18n/index.jsx";
import ResolvedImage from "../components/common/ResolvedImage";
import { Route, Zap, ZapOff, Filter, X, RefreshCw, Package, MapPin, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE = 5;

function Pagination({ page, totalPages, onPage, t }) {
  if (totalPages <= 1) return null;
  const simple = (() => {
    const pages = [1];
    if (page > 3) pages.push("...");
    for (let x = Math.max(2, page-1); x <= Math.min(totalPages-1, page+1); x++) pages.push(x);
    if (page < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  })();
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderTop:"1px solid var(--border-subtle)", background:"var(--bg-elevated)" }}>
      <span style={{ fontSize:12, color:"var(--text-muted)" }}>{t.gpsHistory.page(page, totalPages)}</span>
      <div style={{ display:"flex", gap:4 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page-1)} disabled={page===1}><ChevronLeft size={13} /></button>
        {simple.map((val, i) =>
          val === "..." ? (
            <span key={`d${i}`} style={{ padding:"0 4px", color:"var(--text-muted)", fontSize:12, display:"flex", alignItems:"center" }}>…</span>
          ) : (
            <button key={val} className={`btn btn-sm ${val===page?"btn-primary":"btn-secondary"}`}
              onClick={() => onPage(val)} style={{ minWidth:30, padding:"4px 8px" }}>{val}</button>
          )
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page+1)} disabled={page===totalPages}><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

function LiveMap({ lat, lng, trail = [] }) {
  const mapId = "gps-leaflet-map";
  useEffect(() => {
    if (!lat || !lng || !window.L) return;
    const L = window.L;
    if (window._fleetMap) { window._fleetMap.remove(); window._fleetMap = null; }
    const map = L.map(mapId).setView([lat, lng], 16);
    window._fleetMap = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:"© OpenStreetMap" }).addTo(map);
    if (trail.length > 1) {
      const pts = trail.filter(p => p.latitude && p.longitude).map(p => [p.latitude, p.longitude]);
      if (pts.length > 1) L.polyline(pts, { color:"#1d6fef", weight:3, opacity:0.7 }).addTo(map);
    }
    const icon = L.divIcon({ className:"", html:`<div style="width:14px;height:14px;background:#1d6fef;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(29,111,239,0.5)"></div>`, iconAnchor:[7,7] });
    L.marker([lat, lng], { icon }).addTo(map).bindPopup(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
    return () => { if (window._fleetMap) { window._fleetMap.remove(); window._fleetMap = null; } };
  }, [lat, lng, trail.length]);
  if (!lat || !lng) return null;
  return <div id={mapId} style={{ width:"100%", height:280, borderRadius:"var(--radius-lg)", border:"1px solid var(--border-subtle)", position: "relative", zIndex: 1 }} />;
}

function fmtTs(unix) {
  if (!unix) return "—";
  return new Date(unix*1000).toLocaleString("es-VE", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}
function fmtDate(unix) {
  if (!unix) return "";
  return new Date(unix*1000).toLocaleDateString("es-VE", { day:"2-digit", month:"short", year:"numeric" });
}

export default function GpsHistoryPage() {
  const t = useT();
  const { assets } = useApp();

  const [selectedId, setSelectedId] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [tab,        setTab]        = useState("ignition");
  const [ignPage,    setIgnPage]    = useState(1);
  const [gpsPage,    setGpsPage]    = useState(1);

  const gpsAssets     = assets.filter(a => a.hasTelemetry);
  const selectedAsset = gpsAssets.find(a => a.id === selectedId) || null;
  const hasDeviceId   = selectedAsset && !!selectedAsset.flespiDeviceId;
  const activeDeviceId = hasDeviceId ? String(selectedAsset.flespiDeviceId) : null;
  const activeProvider = selectedAsset?.gpsProvider || "flespi";

  const { messages, ignitionEvents, loading, error, reload } = useMessages(activeDeviceId, activeProvider);

  const fromTs = dateFrom ? new Date(dateFrom).getTime()/1000 : null;
  const toTs   = dateTo   ? (new Date(dateTo).getTime()/1000 + 86400) : null;

  const filteredIgn = useMemo(() => {
    if (!hasDeviceId) return [];
    return ignitionEvents.filter(ev => {
      if (fromTs && ev.timestamp < fromTs) return false;
      if (toTs   && ev.timestamp > toTs)   return false;
      return true;
    }).reverse();
  }, [ignitionEvents, fromTs, toTs, hasDeviceId]);

  const filteredGps = useMemo(() => {
    if (!hasDeviceId) return [];
    return [...messages].reverse().filter(m => {
      if (!m.latitude || !m.longitude) return false;
      if (fromTs && m.timestamp < fromTs) return false;
      if (toTs   && m.timestamp > toTs)   return false;
      return true;
    });
  }, [messages, fromTs, toTs, hasDeviceId]);

  const latestMsg = filteredGps[0] || (messages.length > 0 ? [...messages].reverse().find(m => m.latitude && m.longitude) : null);
  const trail     = useMemo(() => [...filteredGps].reverse().slice(-100), [filteredGps]);

  const ignTotalPages = Math.max(1, Math.ceil(filteredIgn.length / PER_PAGE));
  const gpsTotalPages = Math.max(1, Math.ceil(filteredGps.length / PER_PAGE));
  const ignSlice = filteredIgn.slice((ignPage-1)*PER_PAGE, ignPage*PER_PAGE);
  const gpsSlice = filteredGps.slice((gpsPage-1)*PER_PAGE, gpsPage*PER_PAGE);

  const handleDateFrom = v => { setDateFrom(v); setIgnPage(1); setGpsPage(1); };
  const handleDateTo   = v => { setDateTo(v);   setIgnPage(1); setGpsPage(1); };
  const clearDates     = () => { setDateFrom(""); setDateTo(""); setIgnPage(1); setGpsPage(1); };
  const hasFilter      = dateFrom || dateTo;

  useEffect(() => {
    if (window.L) return;
    const s = document.createElement("script"); s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.async=true; document.head.appendChild(s);
    const l = document.createElement("link"); l.rel="stylesheet"; l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.gpsHistory.title}</h1>
          <p className="page-subtitle">{t.gpsHistory.subtitle}</p>
        </div>
        <button className="btn btn-secondary" onClick={reload} disabled={loading || !activeDeviceId}>
          <RefreshCw size={13} style={{ animation:loading?"spin 0.8s linear infinite":"none" }} /> {t.gpsHistory.refresh}
        </button>
      </div>

      {/* Asset selector */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{t.gpsHistory.selectAsset}</div>
          {gpsAssets.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>{t.gpsHistory.noGpsAssets}</div>
          ) : (
            <select className="form-select" style={{ flex:1, maxWidth:380 }} value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setIgnPage(1); setGpsPage(1); }}>
              <option value="">— {t.gpsHistory.selectPrompt} —</option>
              {gpsAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.brand} {a.model}{a.plate?` · ${a.plate}`:""}{a.flespiDeviceId?` · Device ${a.flespiDeviceId}`:""}
                </option>
              ))}
            </select>
          )}

          {selectedAsset && hasDeviceId && (
            <>
              <div style={{ width:1, height:24, background:"var(--border-default)" }} />
              <Filter size={12} color="var(--text-muted)" />
              <label style={{ fontSize:11, color:"var(--text-muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.gpsHistory.from}</label>
              <input type="date" className="form-input" style={{ width:140, fontSize:12, padding:"5px 9px" }} value={dateFrom} onChange={e => handleDateFrom(e.target.value)} />
              <label style={{ fontSize:11, color:"var(--text-muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.gpsHistory.to}</label>
              <input type="date" className="form-input" style={{ width:140, fontSize:12, padding:"5px 9px" }} value={dateTo} onChange={e => handleDateTo(e.target.value)} />
              {hasFilter && <button className="btn btn-ghost btn-sm" style={{ color:"var(--accent-red)" }} onClick={clearDates}><X size={12} /> {t.gpsHistory.clearDates}</button>}
            </>
          )}
        </div>
      </div>

      {!selectedAsset && (
        <div className="card" style={{ border:"2px dashed var(--border-default)", boxShadow:"none" }}>
          <div className="empty-state" style={{ padding:"60px 24px" }}>
            <Route size={48} color="var(--accent-blue)" style={{ opacity:0.25 }} />
            <p style={{ fontSize:15, fontWeight:600, color:"var(--text-secondary)" }}>
              {gpsAssets.length === 0 ? t.gpsHistory.noGpsAssets.split(".")[0] : t.gpsHistory.selectPrompt}
            </p>
            <p style={{ maxWidth:340 }}>
              {gpsAssets.length === 0 ? t.gpsHistory.noGpsSub : t.gpsHistory.selectSub}
            </p>
          </div>
        </div>
      )}

      {selectedAsset && !hasDeviceId && (
        <div className="card" style={{ background:"var(--accent-amber-light)", border:"1px solid rgba(217,119,6,0.2)" }}>
          <div style={{ fontSize:13, color:"var(--accent-amber)", fontWeight:600 }}>
            ⚠ <strong>{selectedAsset.brand} {selectedAsset.model}</strong> {t.gpsHistory.noDeviceId}
          </div>
        </div>
      )}

      {selectedAsset && hasDeviceId && (
        <>
          {/* Asset pill */}
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16, padding:"12px 16px", background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-sm)" }}>
            {selectedAsset.profilePhoto
              ? <ResolvedImage src={selectedAsset.profilePhoto} alternateSrc={selectedAsset.profilePhotoSource} alt="" style={{ width:42, height:42, borderRadius:"var(--radius-md)", objectFit:"cover" }} />
              : <div style={{ width:42, height:42, borderRadius:"var(--radius-md)", background:"var(--accent-blue-light)", display:"flex", alignItems:"center", justifyContent:"center" }}><Package size={20} color="var(--accent-blue)" /></div>
            }
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{selectedAsset.brand} {selectedAsset.model}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"'IBM Plex Mono',monospace" }}>
                {t.common.deviceId}: {activeDeviceId}{selectedAsset.plate ? ` · ${selectedAsset.plate}` : ""}
              </div>
            </div>
          </div>

          {/* Map */}
          {latestMsg && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--text-muted)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MapPin size={11} color="var(--accent-blue)" />
                {t.gpsHistory.currentPos}{trail.length > 1 ? " " + t.gpsHistory.routePoints(trail.length) : ""}
              </div>
              <LiveMap lat={latestMsg.latitude} lng={latestMsg.longitude} trail={trail} />
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"var(--text-muted)", marginTop:5 }}>
                📍 {latestMsg.latitude?.toFixed(6)}, {latestMsg.longitude?.toFixed(6)} · {fmtTs(latestMsg.timestamp)}
              </div>
            </div>
          )}

          {error  && <div className="error-state" style={{ marginBottom:14 }}>{error}</div>}
          {loading && <div className="loading-state"><div className="spinner" /><span>{t.gpsHistory.loading}</span></div>}

          {!loading && (
            <>
              {/* Tabs */}
              <div style={{ display:"flex", gap:2, marginBottom:14 }}>
                {[
                  { id:"ignition", label:t.gpsHistory.tabMotor,    icon:<Zap size={13} />,   total:filteredIgn.length },
                  { id:"gps",      label:t.gpsHistory.tabPosition,  icon:<Route size={13} />, total:filteredGps.length },
                ].map(tb => (
                  <button key={tb.id} onClick={() => setTab(tb.id)} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", background:tab===tb.id?"var(--accent-blue)":"var(--bg-card)", color:tab===tb.id?"#fff":"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", transition:"var(--transition)" }}>
                    {tb.icon} {tb.label}
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, background:tab===tb.id?"rgba(255,255,255,0.2)":"var(--bg-elevated)", color:tab===tb.id?"#fff":"var(--text-muted)", padding:"1px 7px", borderRadius:20 }}>{tb.total}</span>
                  </button>
                ))}
              </div>

              {/* Ignition tab */}
              {tab === "ignition" && (
                <div className="card" style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-elevated)" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{t.gpsHistory.motorChanges}</span>
                  </div>
                  {filteredIgn.length === 0 ? (
                    <div className="empty-state" style={{ padding:40 }}>
                      <Clock size={28} style={{ opacity:0.3 }} />
                      <p>{hasFilter ? t.gpsHistory.noEventsRange : t.gpsHistory.noEvents}</p>
                    </div>
                  ) : (
                    <>
                      {ignSlice.map((ev, i) => {
                        const on = ev.status === true || ev.status === 1;
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"11px 20px", borderBottom:"1px solid var(--border-subtle)", borderLeft:`3px solid ${on?"var(--accent-green)":"var(--accent-red)"}`}}
                            onMouseOver={e => e.currentTarget.style.background=on?"rgba(15,158,106,0.05)":"rgba(220,38,38,0.05)"}
                            onMouseOut={e => e.currentTarget.style.background=""}>
                            <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:on?"var(--accent-green-light)":"var(--accent-red-light)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {on ? <Zap size={15} color="var(--accent-green)" /> : <ZapOff size={15} color="var(--accent-red)" />}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, fontSize:13, color:on?"var(--accent-green)":"var(--accent-red)" }}>
                                {on ? t.gpsHistory.motorOn : t.gpsHistory.motorOff}
                              </div>
                              {ev.lat != null && (
                                <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"'IBM Plex Mono',monospace", marginTop:1, display:"flex", alignItems:"center", gap:4 }}>
                                  <MapPin size={9} /> {ev.lat.toFixed(5)}, {ev.lng?.toFixed(5)}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-secondary)" }}>{fmtDate(ev.timestamp)}</div>
                              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:600 }}>{ev.timestamp?new Date(ev.timestamp*1000).toLocaleTimeString("es-VE"):"—"}</div>
                            </div>
                          </div>
                        );
                      })}
                      <Pagination page={ignPage} totalPages={ignTotalPages} onPage={setIgnPage} t={t} />
                    </>
                  )}
                </div>
              )}

              {/* GPS tab */}
              {tab === "gps" && (
                <div className="card" style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-elevated)" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{t.gpsHistory.tabPosition}</span>
                  </div>
                  {filteredGps.length === 0 ? (
                    <div className="empty-state" style={{ padding:40 }}>
                      <Route size={28} style={{ opacity:0.3 }} />
                      <p>{hasFilter ? t.gpsHistory.noGpsRange : t.gpsHistory.noGpsData}</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse" }}>
                          <thead>
                            <tr style={{ background:"var(--bg-elevated)" }}>
                              {[t.gpsHistory.colTimestamp, t.gpsHistory.colLat, t.gpsHistory.colLon, t.gpsHistory.colSpeed, t.gpsHistory.colBattery, t.gpsHistory.colMotor].map(h => (
                                <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--text-muted)", whiteSpace:"nowrap", borderBottom:"1px solid var(--border-subtle)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gpsSlice.map((m, i) => {
                              const on = m.ignition === true || m.ignition === 1;
                              return (
                                <tr key={i} style={{ borderBottom:"1px solid var(--border-subtle)" }}
                                  onMouseOver={e => e.currentTarget.style.background="var(--bg-hover)"}
                                  onMouseOut={e => e.currentTarget.style.background=""}>
                                  <td style={{ padding:"9px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--text-secondary)", whiteSpace:"nowrap" }}>{fmtTs(m.timestamp)}</td>
                                  <td style={{ padding:"9px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{m.latitude?.toFixed(6)??"-"}</td>
                                  <td style={{ padding:"9px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{m.longitude?.toFixed(6)??"-"}</td>
                                  <td style={{ padding:"9px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{m.speed!=null?`${m.speed} km/h`:"—"}</td>
                                  <td style={{ padding:"9px 14px", fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>{m.battery!=null?`${m.battery}V`:"—"}</td>
                                  <td style={{ padding:"9px 14px" }}>{m.ignition==null?<span style={{ color:"var(--text-muted)",fontSize:11 }}>—</span>:<span className={`badge ${on?"badge-green":"badge-red"}`} style={{ fontSize:10 }}>{on?"ON":"OFF"}</span>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Pagination page={gpsPage} totalPages={gpsTotalPages} onPage={setGpsPage} t={t} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
