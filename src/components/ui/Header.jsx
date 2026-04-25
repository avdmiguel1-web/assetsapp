import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import LangSwitcher from "./LangSwitcher.jsx";
import { useAuth } from "../../stores/AuthContext";

export default function Header({ onMenuToggle }) {
  const { branding, company } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <header className="top-header">
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menu">
        <Menu size={18} />
      </button>

      <div className="header-breadcrumb" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {branding?.logoHeader
          ? <img src={branding.logoHeader} alt={company?.name || branding.appName || "Logo"} style={{ height: 44, width: "auto", objectFit: "contain", display: "block" }} />
          : <div style={{ fontWeight: 800, fontSize: 18 }}>{branding?.appName || "Gestion de Activos"}</div>}
        {company?.name && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {company.name}
          </div>
        )}
      </div>

      <div className="header-spacer" />

      <LangSwitcher />

      <div className="header-time">
        {time.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })} · {time.toLocaleTimeString("es-VE")}
      </div>
    </header>
  );
}
