import { useState } from "react";
import { useSettings } from "../stores/SettingsContext";
import { useT } from "../i18n/index.jsx";
import { listProviders, getProvider } from "../services/providers/registry";
import {
  Settings, Plus, Trash2, CheckCircle, XCircle, Loader,
  Eye, EyeOff, ToggleLeft, ToggleRight, ExternalLink, X,
  AlertCircle, Zap, Cpu, ChevronDown, ChevronUp, Pencil,
} from "lucide-react";

const PROVIDERS = listProviders();

// ─────────────────────────────────────────────────────────────────────────────
// Provider Form Modal (add / edit GPS platform)
// ─────────────────────────────────────────────────────────────────────────────
function ProviderFormModal({ open, onClose, editing = null }) {
  const t = useT();
  const isEs = t.lang === "es";
  const { saveProvider } = useSettings();

  const [providerId,  setProviderId]  = useState(editing?.provider || "flespi");
  const [label,       setLabel]       = useState(editing?.label    || "");
  const [fields,      setFields]      = useState(() => {
    const f = {};
    if (editing) { f.token = editing.token; f.baseUrl = editing.baseUrl || ""; }
    return f;
  });
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showToken,  setShowToken]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});

  const provider = getProvider(providerId);
  const setField = (k, v) => { setFields(f => ({ ...f, [k]: v })); setTestResult(null); };

  const validate = () => {
    const e = {};
    if (!label.trim()) e.label = t.common.required;
    provider.fields.forEach(f => { if (f.required && !fields[f.key]?.trim()) e[f.key] = t.common.required; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    const result = await provider.testConnection({ token: fields.token, baseUrl: fields.baseUrl });
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await saveProvider({
      id: editing?.id,
      provider: providerId,
      label: label.trim(),
      token: fields.token,
      baseUrl: fields.baseUrl || "",
      isActive: editing?.isActive ?? true,
    });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{editing ? t.settings.modalTitleEdit : t.settings.modalTitleNew}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{t.settings.modalSub}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Platform type */}
          <div className="form-group">
            <label className="form-label">{t.settings.platformLabel}</label>
            <select
              className="form-select"
              value={providerId}
              onChange={e => { setProviderId(e.target.value); setFields({}); setTestResult(null); }}
              disabled={!!editing}
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.logoEmoji} {p.label}</option>)}
            </select>
            {provider && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-secondary)" }}>
                <span style={{ fontSize: 18 }}>{provider.logoEmoji}</span>
                <span style={{ flex: 1 }}>{provider.description}</span>
                <a href={provider.website} target="_blank" rel="noreferrer"
                  style={{ color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none", whiteSpace: "nowrap" }}>
                  {isEs ? "Sitio web" : "Website"} <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>

          {/* Label */}
          <div className="form-group">
            <label className="form-label">{t.settings.labelField}</label>
            <input
              className="form-input"
              placeholder={t.settings.labelPlaceholder}
              value={label}
              onChange={e => { setLabel(e.target.value); setErrors(er => ({ ...er, label: undefined })); }}
            />
            {errors.label && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.label}</span>}
          </div>

          {/* Provider-specific fields */}
          {provider?.fields.map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}{f.required ? " *" : ""}</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={f.type === "password" && !showToken ? "password" : "text"}
                  placeholder={f.placeholder}
                  value={fields[f.key] || ""}
                  onChange={e => setField(f.key, e.target.value)}
                  style={{ paddingRight: f.type === "password" ? 40 : 12 }}
                />
                {f.type === "password" && (
                  <button type="button" onClick={() => setShowToken(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
              {errors[f.key] && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors[f.key]}</span>}
            </div>
          ))}

          {/* Test connection */}
          <div>
            <button
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing || !fields.token}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {testing
                ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {t.settings.testing}</>
                : <><Zap size={14} /> {t.settings.testBtn}</>}
            </button>
            {testResult && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 500,
                background: testResult.ok ? "var(--accent-green-light)" : "var(--accent-red-light)",
                border: `1px solid ${testResult.ok ? "rgba(15,158,106,0.2)" : "rgba(220,38,38,0.2)"}`,
                color: testResult.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
                {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>

          {Object.keys(errors).length > 0 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--accent-red)", fontSize: 12 }}>
              <AlertCircle size={13} /> {t.assetModal.requiredError}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t.settings.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} /> {t.settings.saving}</>
              : t.settings.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS Device Form Modal (add / edit a device linked to a provider)
// ─────────────────────────────────────────────────────────────────────────────
function DeviceFormModal({ open, onClose, providerId, editing = null, onSave }) {
  const t    = useT();
  const isEs = t.lang === "es";

  const [deviceId, setDeviceId] = useState(editing?.deviceId || "");
  const [name,     setName]     = useState(editing?.name     || "");
  const [notes,    setNotes]    = useState(editing?.notes    || "");
  const [errors,   setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!deviceId.trim()) e.deviceId = isEs ? "Requerido" : "Required";
    if (!name.trim())     e.name     = isEs ? "Requerido" : "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      id:         editing?.id || `dev_${Date.now()}`,
      providerId,
      deviceId:   deviceId.trim(),
      name:       name.trim(),
      notes:      notes.trim(),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {editing
                ? (isEs ? "Editar Dispositivo GPS" : "Edit GPS Device")
                : (isEs ? "Agregar Dispositivo GPS" : "Add GPS Device")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {isEs ? "Registra un dispositivo de rastreo en esta plataforma" : "Register a tracking device on this platform"}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              {isEs ? "Device ID *" : "Device ID *"}
            </label>
            <input
              className="form-input"
              placeholder={isEs ? "Ej: 7813187" : "e.g. 7813187"}
              value={deviceId}
              onChange={e => { setDeviceId(e.target.value); setErrors(er => ({ ...er, deviceId: undefined })); }}
            />
            {errors.deviceId && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.deviceId}</span>}
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              {isEs ? "ID numérico del dispositivo en la plataforma GPS" : "Numeric device ID in the GPS platform"}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">
              {isEs ? "Nombre del Dispositivo *" : "Device Name *"}
            </label>
            <input
              className="form-input"
              placeholder={isEs ? "Ej: Camión Principal VE-01" : "e.g. Main Truck VE-01"}
              value={name}
              onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: undefined })); }}
            />
            {errors.name && <span style={{ fontSize: 10, color: "var(--accent-red)" }}>{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">
              {isEs ? "Notas (opcional)" : "Notes (optional)"}
            </label>
            <input
              className="form-input"
              placeholder={isEs ? "Ej: SINOTRACKER ST-901, SIM: 58-412-..." : "e.g. SINOTRACKER ST-901, SIM: ..."}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {isEs ? "Cancelar" : "Cancel"}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEs ? "Guardar Dispositivo" : "Save Device"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS Devices sub-panel (shown expanded inside each provider card)
// ─────────────────────────────────────────────────────────────────────────────
function DevicesPanel({ provider: s }) {
  const t    = useT();
  const isEs = t.lang === "es";
  const { saveDevice, deleteDevice, providerDevices } = useSettings();

  const devices = providerDevices(s.id);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingDev,  setEditingDev]  = useState(null);

  const handleSave = (device) => saveDevice(device);

  const handleDelete = (dev) => {
    const msg = isEs
      ? `¿Eliminar el dispositivo "${dev.name}"?`
      : `Delete device "${dev.name}"?`;
    if (window.confirm(msg)) deleteDevice(dev.id);
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          <Cpu size={12} style={{ marginRight: 5, verticalAlign: "middle" }} />
          {isEs ? "Dispositivos GPS" : "GPS Devices"}
          {devices.length > 0 && (
            <span style={{ marginLeft: 6, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
              {devices.length}
            </span>
          )}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { setEditingDev(null); setModalOpen(true); }}
        >
          <Plus size={12} /> {isEs ? "Agregar" : "Add"}
        </button>
      </div>

      {devices.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0", textAlign: "center" }}>
          {isEs
            ? "No hay dispositivos registrados en esta plataforma."
            : "No devices registered on this platform."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {devices.map(dev => (
            <div key={dev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--bg-base)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Cpu size={14} color="var(--accent-blue)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{dev.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--text-muted)" }}>
                    ID: {dev.deviceId}
                  </span>
                  {dev.notes && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {dev.notes}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => { setEditingDev(dev); setModalOpen(true); }}
                  title={isEs ? "Editar" : "Edit"}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ color: "var(--accent-red)" }}
                  onClick={() => handleDelete(dev)}
                  title={isEs ? "Eliminar" : "Delete"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeviceFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDev(null); }}
        providerId={s.id}
        editing={editingDev}
        onSave={handleSave}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const t = useT();
  const isEs = t.lang === "es";
  const { settings, loading, deleteProvider, toggleActive } = useSettings();

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [showTokens,   setShowTokens]   = useState({});
  const [expandedDevs, setExpandedDevs] = useState({});

  const toggleShowToken  = (id) => setShowTokens(s => ({ ...s, [id]: !s[id] }));
  const toggleDevices    = (id) => setExpandedDevs(s => ({ ...s, [id]: !s[id] }));
  const masked           = (token) => token ? token.slice(0, 8) + "••••••••••••" + token.slice(-4) : "—";

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.settings.title}</h1>
          <p className="page-subtitle">{t.settings.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={14} /> {t.settings.newBtn}
        </button>
      </div>

      {/* ── Provider list ── */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>{t.common.loading}</span></div>
      ) : settings.length === 0 ? (
        <div className="card" style={{ border: "2px dashed var(--border-default)", boxShadow: "none" }}>
          <div className="empty-state" style={{ padding: "60px 24px" }}>
            <Settings size={48} color="var(--accent-blue)" style={{ opacity: 0.25 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{t.settings.noProviders}</p>
            <p style={{ maxWidth: 380 }}>{t.settings.noProvidersSub}</p>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus size={14} /> {t.settings.addFirst}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {settings.map(s => {
            const prov       = getProvider(s.provider);
            const devExpanded = expandedDevs[s.id];

            return (
              <div key={s.id} className="card" style={{ opacity: s.isActive ? 1 : 0.6, transition: "var(--transition)" }}>
                {/* Provider header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: prov ? `${prov.color}18` : "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: `1px solid ${prov?.color || "var(--border-default)"}30` }}>
                    {prov?.logoEmoji || "🔌"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{s.label}</span>
                      <span className={`badge ${s.isActive ? "badge-green" : "badge-muted"}`}>
                        {s.isActive ? t.settings.active : t.settings.inactive}
                      </span>
                      <span className="badge badge-muted">{prov?.label || s.provider}</span>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                        {t.settings.tokenLabel}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {showTokens[s.id] ? s.token : masked(s.token)}
                      </span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleShowToken(s.id)}>
                        {showTokens[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    {s.baseUrl && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {t.settings.urlLabel} {s.baseUrl}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {/* Expand/collapse devices */}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleDevices(s.id)}
                      style={{ color: "var(--accent-blue)", gap: 4 }}
                      title={isEs ? "Dispositivos GPS" : "GPS Devices"}
                    >
                      <Cpu size={14} />
                      {devExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleActive(s.id)}
                      style={{ color: s.isActive ? "var(--accent-green)" : "var(--text-muted)" }}
                    >
                      {s.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(s); setModalOpen(true); }}>
                      {t.settings.edit}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: "var(--accent-red)" }}
                      onClick={() => window.confirm(`${t.common.delete} "${s.label}"?`) && deleteProvider(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Devices panel (collapsible) */}
                {devExpanded && <DevicesPanel provider={s} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Security note ── */}
      <div style={{ marginTop: 24, padding: "14px 18px", background: "var(--accent-blue-light)", border: "1px solid var(--accent-blue-mid)", borderRadius: "var(--radius-lg)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        {t.settings.securityNote}
        {" "}<strong>{isEs ? "Plataformas disponibles:" : "Available platforms:"}</strong>{" "}
        {PROVIDERS.map(p => `${p.logoEmoji} ${p.label}`).join(" · ")}
      </div>

      <ProviderFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
      />
    </div>
  );
}
