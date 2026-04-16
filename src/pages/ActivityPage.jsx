import { useEffect, useMemo, useState } from "react";
import { dbFetchAuditLogs } from "../lib/db";
import { useT } from "../i18n/index.jsx";
import { AlertCircle, ChevronLeft, ChevronRight, History, RefreshCcw, Search } from "lucide-react";

const ACTION_VERBS = {
  create:   { es: "Creacion",   en: "Created" },
  update:   { es: "Edicion",    en: "Updated" },
  delete:   { es: "Eliminacion",en: "Deleted" },
  transfer: { es: "Traslado",   en: "Transferred" },
  rental_return: { es: "Retorno de alquiler", en: "Rental return" },
};

const ENTITY_LABELS = {
  asset:    { es: "activo",    en: "asset" },
  category: { es: "categoria", en: "category" },
  location: { es: "ubicacion", en: "location" },
  country:  { es: "pais",      en: "country" },
  user:     { es: "usuario",   en: "user" },
};

function formatAction(log, lang) {
  if (log.action === "rental_return") {
    return log.details?.title || ACTION_VERBS.rental_return?.[lang] || log.action;
  }
  const verb   = ACTION_VERBS[log.action]?.[lang] || log.action;
  const entity = ENTITY_LABELS[log.entityType]?.[lang] || log.entityType || (lang === "en" ? "record" : "registro");
  return lang === "en" ? `${verb} ${entity}` : `${verb} de ${entity}`;
}

function parseDateInput(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Derives what to show in the "Antes" and "Actualizado" columns
 * based on action type and entity type.
 *
 * Returns { subtitle, before, after }
 *   subtitle — small label shown above the value (e.g. Asset ID)
 *   before   — value in the "Antes" column
 *   after    — value in the "Actualizado" column (null when not applicable)
 */
function deriveCells(log, lang) {
  const details     = log.details || {};
  const action      = log.action;
  const entityType  = log.entityType;
  const isEs        = lang === "es";

  // â”€â”€ TRANSFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === "transfer" || action === "rental_return") {
    return {
      subtitle: details.assetId || "",
      before:   details.fromLocation || (isEs ? "Sin ubicación" : "No location"),
      after:    details.toLocation   || (isEs ? "Sin ubicación" : "No location"),
    };
  }

  // â”€â”€ UPDATE (edición) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” € 
  if (action === "update") {
    const before = details.before || {};
    const after  = details.after  || {};

    if (entityType === "asset") {
      // Compute first changed field to display
      const changedKey = Object.keys(after).find(
        (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
      );
      const subtitle = details.assetId || before.assetId || after.assetId || "";
      if (changedKey) {
        return {
          subtitle,
          before: String(before[changedKey] ?? "—"),
          after:  String(after[changedKey]  ?? "—"),
        };
      }
      return {
        subtitle,
        before: isEs ? "Sin cambios detectados" : "No changes detected",
        after:  null,
      };
    }

    if (entityType === "user") {
      const changedKey = Object.keys(after).find(
        (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
      );
      const subtitle = "";
      if (changedKey) {
        return {
          subtitle,
          before: String(before[changedKey] ?? "—"),
          after:  String(after[changedKey]  ?? "—"),
        };
      }
      return {
        subtitle,
        before: isEs ? "Sin cambios detectados" : "No changes detected",
        after:  null,
      };
    }

    if (entityType === "category" || entityType === "location" || entityType === "country") {
      const changedKey = Object.keys(after).find(
        (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
      );
      if (changedKey) {
        return {
          subtitle: "",
          before: String(before[changedKey] ?? "—"),
          after:  String(after[changedKey]  ?? "—"),
        };
      }
      return {
        subtitle: "",
        before: isEs ? "Sin cambios detectados" : "No changes detected",
        after:  null,
      };
    }

    // Generic update fallback
    const changedKey = Object.keys(after).find(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changedKey) {
      return {
        subtitle: "",
        before: String(before[changedKey] ?? "—"),
        after:  String(after[changedKey]  ?? "—"),
      };
    }
    return { subtitle: "", before: isEs ? "Sin cambios" : "No changes", after: null };
  }

  // â”€â”€ CREATE / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === "create" || action === "delete") {
    if (entityType === "asset") {
      const src = details.before || details.after || details;
      const brand   = src.brand   || "—";
      const model   = src.model   || "—";
      const assetId = src.assetId || details.assetId || "";
      return {
        subtitle: assetId,
        before:   `${brand} ${model}`.trim() || "—",
        after:    null,
      };
    }

    if (entityType === "user") {
      const src      = details.before || details.after || details;
      const fullName = src.name || src.fullName || src.userName || log.entityLabel || "—";
      return {
        subtitle: "",
        before:   fullName,
        after:    null,
      };
    }

    if (entityType === "category") {
      const src  = details.before || details.after || details;
      const name = src.name || log.entityLabel || "—";
      return {
        subtitle: "",
        before:   name,
        after:    null,
      };
    }

    if (entityType === "location") {
      const src  = details.before || details.after || details;
      const name = src.name || log.entityLabel || "—";
      return {
        subtitle: "",
        before:   name,
        after:    null,
      };
    }

    // Generic create / delete
    const src  = details.before || details.after || details;
    const name = src.name || log.entityLabel || log.entityId || "—";
    return {
      subtitle: "",
      before:   name,
      after:    null,
    };
  }

  // â”€â”€ Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return {
    subtitle: "",
    before:   log.entityLabel || log.entityId || "—",
    after:    null,
  };
}

// Styles shared across all cells
const TH = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 11,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border-subtle)",
  whiteSpace: "nowrap",
};
const TD = { padding: "12px 16px", fontSize: 13, verticalAlign: "top" };

export default function ActivityPage() {
  const t    = useT();
  const lang = t.lang || "es";

  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [action,   setAction]   = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [page,     setPage]     = useState(1);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await dbFetchAuditLogs();
      setLogs(data);
    } catch (e) {
      setError(e.message || "No se pudo cargar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q    = search.trim().toLowerCase();
    const from = parseDateInput(fromDate, false);
    const to   = parseDateInput(toDate,   true);

    return logs.filter((log) => {
      const createdAt = log.createdAt ? new Date(log.createdAt) : null;
      if (action && log.action !== action) return false;
      if (from && (!createdAt || createdAt < from)) return false;
      if (to   && (!createdAt || createdAt > to))   return false;
      if (!q) return true;

      const details = log.details || {};
      const src = details.before || details.after || details;
      return `${log.userName || ""} ${log.userEmail || ""} ${log.entityLabel || ""} ${log.entityId || ""} ${src.brand || ""} ${src.model || ""} ${src.assetId || ""} ${log.action || ""} ${log.entityType || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [action, fromDate, logs, search, toDate]);

  useEffect(() => { setPage(1); }, [search, action, fromDate, toDate]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated   = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered]);

  const isEs = lang === "es";

  return (
    <div>
      {/* â”€â”€ Header â”€â”€ */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEs ? "Actividad" : "Activity"}</h1>
          <p className="page-subtitle">
            {isEs
              ? `${logs.length} evento${logs.length !== 1 ? "s" : ""} registrado${logs.length !== 1 ? "s" : ""}`
              : `${logs.length} event${logs.length !== 1 ? "s" : ""} recorded`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCcw size={14} />
          {loading ? (isEs ? "Actualizando..." : "Refreshing...") : (isEs ? "Actualizar" : "Refresh")}
        </button>
      </div>

      {/* â”€â”€ Filters â”€â”€ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 240 }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              placeholder={isEs
                ? "Buscar por usuario, ID activo, marca, modelo..."
                : "Search by user, asset ID, brand or model..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: "auto", minWidth: 180 }}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">{isEs ? "Todas las acciones" : "All actions"}</option>
            {Object.keys(ACTION_VERBS).map((key) => (
              <option key={key} value={key}>{ACTION_VERBS[key]?.[lang] || key}</option>
            ))}
          </select>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 165 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
              {isEs ? "Desde" : "From"}
            </label>
            <input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 165 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
              {isEs ? "Hasta" : "To"}
            </label>
            <input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          {(search || action || fromDate || toDate) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--accent-red)" }}
              onClick={() => { setSearch(""); setAction(""); setFromDate(""); setToDate(""); }}
            >
              {isEs ? "Limpiar filtros" : "Clear filters"}
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Content â”€â”€ */}
      {error ? (
        <div className="card" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {isEs ? "No se pudo cargar la actividad" : "Unable to load activity"}
              </div>
              <div style={{ fontSize: 13 }}>{error}</div>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 48 }}>
            <RefreshCcw size={28} style={{ opacity: 0.4 }} />
            <p>{isEs ? "Cargando actividad..." : "Loading activity..."}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 56 }}>
            <History size={44} color="var(--accent-blue)" style={{ opacity: 0.28 }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>
              {isEs ? "No hay actividad para mostrar" : "No activity found"}
            </p>
            <p style={{ maxWidth: 420 }}>
              {isEs
                ? "Aqui apareceran los eventos de activos, categorias, ubicaciones, paises y usuarios."
                : "Asset, category, location, country and user events will appear here."}
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th style={TH}>{isEs ? "Accion"       : "Action"}</th>
                  <th style={TH}>{isEs ? "Usuario"      : "User"}</th>
                  <th style={TH}>{isEs ? "Antes"        : "Before"}</th>
                  <th style={TH}>{isEs ? "Actualizado"  : "Updated"}</th>
                  <th style={{ ...TH }}>{isEs ? "Fecha y Hora" : "Date & Time"}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => {
                  const { subtitle, before, after } = deriveCells(log, lang);

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {/* Action */}
                      <td style={{ ...TD, fontWeight: 600 }}>
                        {formatAction(log, lang)}
                      </td>

                      {/* User */}
                      <td style={{ ...TD, color: "var(--text-secondary)" }}>
                        {log.userName || log.userEmail || (isEs ? "Usuario desconocido" : "Unknown user")}
                      </td>

                      {/* Before */}
                      <td style={TD}>
                        {subtitle && (
                          <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--accent-amber)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 3,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}>
                            {subtitle}
                          </div>
                        )}
                        <span style={{
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontFamily: log.action === "transfer" || !subtitle
                            ? "inherit"
                            : "'IBM Plex Mono', monospace",
                        }}>
                          {before || "—"}
                        </span>
                      </td>

                      {/* Updated */}
                      <td style={TD}>
                        {after != null ? (
                          <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}>
                            {after}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        {log.createdAt ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                              {new Date(log.createdAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                              {new Date(log.createdAt).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {isEs
                ? `Mostrando ${paginated.length} de ${filtered.length} registros`
                : `Showing ${paginated.length} of ${filtered.length} records`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={13} /> {isEs ? "Anterior" : "Previous"}
              </button>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 90, textAlign: "center" }}>
                {isEs ? `Pagina ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                disabled={currentPage === totalPages}
              >
                {isEs ? "Siguiente" : "Next"} <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



