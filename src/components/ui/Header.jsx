import { useState, useEffect } from "react";
import { ChevronRight, Menu, LogOut, Shield, User } from "lucide-react";
import LOGO from "../../assets/logo.js";
import LangSwitcher from "./LangSwitcher.jsx";
import { useT } from "../../i18n/index.jsx";
import { useAuth } from "../../stores/AuthContext";

export default function Header({ page, onMenuToggle }) {
  const t = useT();
  const { profile, isAdmin, signOut } = useAuth();
  const [time, setTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const LABELS = {
    dashboard:  t.nav.dashboard,
    locations:  t.nav.locations,
    activity:   t.nav.activity,
    transfers:  t.nav.transfers,
    gpshistory: t.nav.gpshistory,
    settings:   t.nav.settings,
    categories: t.nav.categories,
    users:      t.nav.users || "Usuarios",
  };

  const lang = t.lang;

  return (
    <header className="top-header">
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menú">
        <Menu size={18} />
      </button>

      <div className="header-breadcrumb">
        <img src={LOGO} alt="Logo" style={{ height:60, width:"auto", objectFit:"contain", display:"block" }} />
      </div>

      <div className="header-spacer" />

      <LangSwitcher />

      {/* Clock — hidden on mobile */}
      <div className="header-time">
        {time.toLocaleDateString("es-VE", { day:"2-digit", month:"short", year:"numeric" })} · {time.toLocaleTimeString("es-VE")}
      </div>
    </header>
  );
}
