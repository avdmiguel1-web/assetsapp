import { useCallback, useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "./stores/AppContext";
import { SettingsProvider } from "./stores/SettingsContext";
import { AuthProvider, useAuth } from "./stores/AuthContext";
import { LangProvider, useT } from "./i18n/index.jsx";
import { useProviderConfig } from "./hooks/useProviderConfig";
import { applyBrandingToDocument } from "./lib/brandingRuntime";
import Sidebar from "./components/ui/Sidebar";
import Header from "./components/ui/Header";
import SyncBanner from "./components/ui/SyncBanner";
import AuthPage       from "./pages/AuthPage";
import DashboardPage  from "./pages/DashboardPage";
import LocationsPage  from "./pages/LocationsPage";
import TransfersPage  from "./pages/TransfersPageFixed";
import GpsHistoryPage from "./pages/GpsHistoryPage";
import SettingsPage   from "./pages/SettingsPage";
import CategoriesPage from "./pages/CategoriesPage";
import ActivityPage   from "./pages/ActivityPage";
import UsersPage      from "./pages/UsersPage";
import { getRentalCountdownState, isRentalLocationName } from "./lib/locationUtils";

const RENTAL_NOTIFICATION_STORAGE_KEY = "fleet:rental-notified";

function loadStoredRentalNotifications() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RENTAL_NOTIFICATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRentalNotifications(keys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RENTAL_NOTIFICATION_STORAGE_KEY, JSON.stringify([...keys]));
}

function RentalNotifications({ items, onDismiss, onOpen }) {
  if (!items.length) return null;

  return (
    <div style={{ position: "fixed", top: 88, right: 20, zIndex: 700, display: "flex", flexDirection: "column", gap: 10, width: "min(360px, calc(100vw - 32px))" }}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item)}
          style={{
            textAlign: "left",
            border: "1px solid rgba(29,111,239,0.2)",
            background: "linear-gradient(135deg, #ffffff 0%, #eef5ff 100%)",
            boxShadow: "0 18px 42px rgba(15, 23, 42, 0.16)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-red)", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{item.message}</div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onDismiss(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onDismiss(item.id);
                }
              }}
              style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1, paddingLeft: 6 }}
            >
              ×
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// Inactive account screen
function InactiveScreen() {
  const { signOut } = useAuth();
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-base)" }}>
      <div className="card" style={{ maxWidth:400, textAlign:"center", padding:"40px 36px" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Cuenta deshabilitada</h2>
        <p style={{ color:"var(--text-muted)", fontSize:13, marginBottom:24 }}>
          Tu cuenta ha sido deshabilitada por el administrador. Contacta al administrador del sistema.
        </p>
        <button className="btn btn-secondary" onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  );
}

function BrandingEffects() {
  const { branding, company, session } = useAuth();

  useEffect(() => {
    return applyBrandingToDocument(session ? branding : {}, session ? (company?.name || "") : "");
  }, [branding, company?.name, session]);

  return null;
}

function Shell() {
  const t = useT();
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailAssetId, setDetailAssetId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [rentalClock, setRentalClock] = useState(() => Date.now());
  const { assets, locations } = useApp();
  const { isAdmin, canDo, profile, signOut, isFeatureEnabled } = useAuth();
  const notifiedRentalKeysRef = useRef(new Set(loadStoredRentalNotifications()));

  useProviderConfig();

  const dismissNotification = useCallback((notificationId) => {
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
  }, []);

  const openAssetDetail = useCallback((assetId) => {
    setPage("dashboard");
    setDetailAssetId(assetId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setRentalClock(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const now = new Date(rentalClock);

    assets.forEach((asset) => {
      if (!isRentalLocationName(asset.location || "")) return;

      const rentalState = getRentalCountdownState(asset, now, t.lang);
      if (!rentalState || (rentalState.phase !== "due" && rentalState.phase !== "overdue")) return;

      const notificationKey = [
        asset.id,
        asset.location,
        rentalState.kind,
        asset.rentalStartDate || "",
        asset.rentalEndDate || "",
        asset.rentalStartTime || "",
        asset.rentalEndTime || "",
      ].join("|");

      if (notifiedRentalKeysRef.current.has(notificationKey)) return;

      notifiedRentalKeysRef.current.add(notificationKey);
      persistRentalNotifications(notifiedRentalKeysRef.current);

      const notificationId = `${notificationKey}|${Date.now()}`;
      const title = t.lang === "en"
        ? `Rental due: ${asset.brand} ${asset.model}`
        : `Alquiler vencido: ${asset.brand} ${asset.model}`;
      const message = rentalState.phase === "overdue"
        ? (t.lang === "en"
          ? `The asset already has ${rentalState.displayLabel} extra. Click to open asset information.`
          : `El activo ya acumula ${rentalState.displayLabel} extra. Haz clic para abrir la información del activo.`)
        : (t.lang === "en"
          ? "The rental countdown reached 0. Click to open asset information."
          : "El conteo del alquiler llegó a 0. Haz clic para abrir la información del activo.");

      setNotifications((current) => [...current, { id: notificationId, assetId: asset.id, title, message }]);
      window.setTimeout(() => {
        setNotifications((current) => current.filter((item) => item.id !== notificationId));
      }, 5000);
    });
  }, [assets, rentalClock, t.lang]);

  // Build page map — filtered by permissions
  const dashboardPage = (
    <DashboardPage
      detailAssetId={detailAssetId}
      onOpenAssetDetail={openAssetDetail}
      onCloseAssetDetail={() => setDetailAssetId(null)}
    />
  );

  const pages = {
    dashboard: dashboardPage,
    ...(canDo("module_locations") ? { locations: <LocationsPage /> } : {}),
    ...(canDo("module_categories") ? { categories: <CategoriesPage /> } : {}),
    ...(canDo("module_activity") && isFeatureEnabled("module.activity", true) ? { activity: <ActivityPage /> } : {}),
    ...(canDo("module_transfers") ? { transfers: <TransfersPage /> } : {}),
    ...(canDo("module_gpshistory") && isFeatureEnabled("module.gpshistory", true) ? { gpshistory: <GpsHistoryPage /> } : {}),
    ...(canDo("module_settings") ? { settings: <SettingsPage /> } : {}),
    ...(isAdmin ? { users: <UsersPage /> } : {}),
  };

  const currentPage = pages[page] ? page : "dashboard";

  return (
    <div className="app-shell">
      <Sidebar
        page={currentPage}
        onNav={(nextPage) => setPage(nextPage)}
        locationCount={locations.length}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canDo={canDo}
        isAdmin={isAdmin}
        profile={profile}
        onSignOut={signOut}
      />
      <div className="main-content">
        <Header onMenuToggle={() => setSidebarOpen((open) => !open)} />
        <div className="page-body">
          <SyncBanner />
          {pages[currentPage] ?? dashboardPage}
        </div>
      </div>
      <RentalNotifications
        items={notifications}
        onDismiss={dismissNotification}
        onOpen={(item) => {
          dismissNotification(item.id);
          openAssetDetail(item.assetId);
        }}
      />
    </div>
  );
}

// Auth gate — show login if no session
function AuthGate() {
  const { session, loading, isActive } = useAuth();

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-base)" }}>
      <div style={{ textAlign:"center" }}>
        <div className="spinner" style={{ width:32, height:32, borderWidth:3, margin:"0 auto 12px" }} />
        <div style={{ color:"var(--text-muted)", fontSize:13 }}>Cargando Gestion de Activos...</div>
      </div>
    </div>
  );

  if (!session) return <AuthPage />;
  if (!isActive) return <InactiveScreen />;

  return (
    <SettingsProvider>
      <BrandingEffects />
      <AppProvider>
        <Shell />
      </AppProvider>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </LangProvider>
  );
}
