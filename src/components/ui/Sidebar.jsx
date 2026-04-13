import { LayoutDashboard, MapPin, ArrowLeftRight, Route, Satellite, Settings, Tag, X, Users, LogOut, Shield, History } from "lucide-react";
import { useTelemetry } from "../../hooks/useTelemetry";
import { DEFAULT_DEVICE_ID } from "../../services/flespiService";
import { useT } from "../../i18n/index.jsx";

export default function Sidebar({ page, onNav, locationCount=0, open, onClose, canDo, isAdmin, profile, onSignOut }) {
  const t = useT();
  const lang = t.lang;
  const { telemetry: t2, error } = useTelemetry(DEFAULT_DEVICE_ID, 30000);
  const isLive = !error && t2 && !t2.isEmpty;

  // Build nav dynamically based on permissions
  const NAV = [
    { id:"dashboard",  label:t.nav.dashboard,  icon:LayoutDashboard, always:true },
    { id:"locations",  label:t.nav.locations,   icon:MapPin,          perm:"module_locations" },
    { id:"categories", label:t.nav.categories,  icon:Tag,             perm:"module_categories" },
    { id:"activity",   label:t.nav.activity,    icon:History,         perm:"module_activity" },
    { id:"transfers",  label:t.nav.transfers,   icon:ArrowLeftRight,  perm:"module_transfers" },
    { id:"gpshistory", label:t.nav.gpshistory,  icon:Route,           perm:"module_gpshistory" },
  ].filter(item => item.always || !canDo || canDo(item.perm));

  const SYSTEM_NAV = [
    ...(canDo?.("module_settings") ? [{ id:"settings", label:t.nav.settings, icon:Settings }] : []),
    ...(isAdmin ? [{ id:"users", label: lang==="en"?"Users":"Usuarios", icon:Users }] : []),
  ];

  const handleNav = (id) => { onNav(id); onClose?.(); };

  return (
    <>
      <div className={`sidebar-overlay ${open ? "visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="sidebar-logo-icon"><Satellite size={18} color="#fff" /></div>
            <div>
              <div className="sidebar-logo-text">Gestión de Activos</div>
              <div className="sidebar-logo-sub">Asset Management</div>
            </div>
            <button onClick={onClose} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", padding:4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">{t.nav.modules}</div>
          {NAV.map(({ id, label, icon: Icon, countKey }) => {
            const badge = countKey === "locations" && locationCount > 0 ? locationCount : null;
            return (
              <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => handleNav(id)}>
                <Icon size={16} />
                <span className="nav-label">{label}</span>
                {badge != null && <span className="nav-badge">{badge}</span>}
              </button>
            );
          })}

          {SYSTEM_NAV.length > 0 && (
            <>
              <div className="sidebar-section-label" style={{ marginTop:16 }}>{t.nav.system}</div>
              {SYSTEM_NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => handleNav(id)}>
                  <Icon size={16} />
                  <span className="nav-label">{label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* User info + sign out */}
        
          <div className="sidebar-device-pill">
            
          {profile && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background: isAdmin ? "var(--accent-blue)" : "rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                {isAdmin ? "👑" : "👤"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {profile.full_name || profile.email}
                </div>
                <div style={{ fontSize:12, color: isAdmin ? "rgba(29,111,239,0.8)" : "rgba(255,255,255,0.4)", display:"flex", alignItems:"center", gap:4 }}>
                  {isAdmin ? <><Shield size={12} /> {lang==="en"?"Administrator":"Administrador"}</> : (lang==="en"?"User":"Usuario")}
                </div>
              </div>
              <button onClick={onSignOut} title={lang==="en"?"Sign out":"Cerrar sesión"}
                style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.4)", padding:4, borderRadius:"var(--radius-sm)", transition:"var(--transition)" }}
                onMouseOver={e => e.currentTarget.style.color="rgba(220,38,38,0.8)"}
                onMouseOut={e => e.currentTarget.style.color="rgba(255,255,255,0.4)"}>
                <LogOut size={20} />
              </button>
            </div>
          )}
          </div>
        
      </aside>
    </>
  );
}
