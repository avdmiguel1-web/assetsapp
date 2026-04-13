import { useState } from "react";
import { AppProvider, useApp } from "./stores/AppContext";
import { SettingsProvider } from "./stores/SettingsContext";
import { AuthProvider, useAuth } from "./stores/AuthContext";
import { LangProvider } from "./i18n/index.jsx";
import { useProviderConfig } from "./hooks/useProviderConfig";
import Sidebar from "./components/ui/Sidebar";
import Header from "./components/ui/Header";
import SyncBanner from "./components/ui/SyncBanner";
import AuthPage       from "./pages/AuthPage";
import DashboardPage  from "./pages/DashboardPage";
import LocationsPage  from "./pages/LocationsPage";
import TransfersPage  from "./pages/TransfersPage";
import GpsHistoryPage from "./pages/GpsHistoryPage";
import SettingsPage   from "./pages/SettingsPage";
import CategoriesPage from "./pages/CategoriesPage";
import ActivityPage   from "./pages/ActivityPage";
import UsersPage      from "./pages/UsersPage";
import { Loader } from "lucide-react";

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

function Shell() {
  const [page,        setPage]        = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { assets, locations } = useApp();
  const { isAdmin, canDo, profile, signOut } = useAuth();

  useProviderConfig();

  // Build page map — filtered by permissions
  const PAGES = {
    dashboard:  <DashboardPage />,
    ...(canDo("module_locations")  ? { locations:  <LocationsPage /> }  : {}),
    ...(canDo("module_categories") ? { categories: <CategoriesPage /> } : {}),
    ...(canDo("module_activity")   ? { activity:   <ActivityPage /> }   : {}),
    ...(canDo("module_transfers")  ? { transfers:  <TransfersPage /> }  : {}),
    ...(canDo("module_gpshistory") ? { gpshistory: <GpsHistoryPage /> } : {}),
    ...(canDo("module_settings")   ? { settings:   <SettingsPage /> }   : {}),
    ...(isAdmin                    ? { users:       <UsersPage /> }      : {}),
  };

  // If current page is no longer accessible, go to dashboard
  const currentPage = PAGES[page] ? page : "dashboard";

  return (
    <div className="app-shell">
      <Sidebar
        page={currentPage}
        onNav={p => setPage(p)}
        locationCount={locations.length}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canDo={canDo}
        isAdmin={isAdmin}
        profile={profile}
        onSignOut={signOut}
      />
      <div className="main-content">
        <Header page={currentPage} onMenuToggle={() => setSidebarOpen(o => !o)} />
        <div className="page-body">
          <SyncBanner />
          {PAGES[currentPage] ?? <DashboardPage />}
        </div>
      </div>
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
