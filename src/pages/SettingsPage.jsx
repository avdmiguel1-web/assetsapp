import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Cpu, Eye, EyeOff, ExternalLink, ImagePlus, Loader, Palette, Plus, Save, Settings, ToggleLeft, ToggleRight, Trash2, Wand2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../stores/SettingsContext";
import { useAuth } from "../stores/AuthContext";
import { useT } from "../i18n/index.jsx";
import { buildBrandingAssetSet } from "../lib/brandingAssets";
import { DEFAULT_COMPANY_FLAGS } from "../lib/companyConfig";
import { getProvider, listProviders } from "../services/providers/registry";

const FEATURE_FLAG_GROUPS = {
  modules: [
    { key: "module.activity", labelEs: "Actividad", labelEn: "Activity", descriptionEs: "Activa o desactiva el modulo de actividad para toda la empresa.", descriptionEn: "Enable or disable the activity module for the whole company." },
    { key: "module.gpshistory", labelEs: "Historial GPS", labelEn: "GPS history", descriptionEs: "Controla si la empresa ve el historial GPS.", descriptionEn: "Controls whether the company can access GPS history." },
  ],
  gps: [
    { key: "gps.deviceProvisioning", labelEs: "Registro directo de dispositivos", labelEn: "Direct device provisioning", descriptionEs: "Permite crear dispositivos en Flespi, Wialon o Traccar desde la app.", descriptionEn: "Allows creating devices in Flespi, Wialon or Traccar from the app." },
    { key: "gps.provider.flespi", labelEs: "Proveedor Flespi", labelEn: "Flespi provider", descriptionEs: "Muestra Flespi en la configuracion de la empresa.", descriptionEn: "Shows Flespi in company settings." },
    { key: "gps.provider.wialon", labelEs: "Proveedor Wialon", labelEn: "Wialon provider", descriptionEs: "Muestra Wialon en la configuracion de la empresa.", descriptionEn: "Shows Wialon in company settings." },
    { key: "gps.provider.traccar", labelEs: "Proveedor Traccar", labelEn: "Traccar provider", descriptionEs: "Muestra Traccar en la configuracion de la empresa.", descriptionEn: "Shows Traccar in company settings." },
  ],
  system: [
    { key: "system.branding", labelEs: "Branding de empresa", labelEn: "Company branding", descriptionEs: "Permite personalizar logo e identidad visual por cliente.", descriptionEn: "Allows per-company logo and visual identity customization." },
    { key: "system.featureFlags", labelEs: "Feature flags", labelEn: "Feature flags", descriptionEs: "Activa la administracion de flags por empresa.", descriptionEn: "Enables company-level feature flag management." },
  ],
};

function ProviderFormModal({ open, onClose, editing }) {
  const { saveProvider } = useSettings();
  const { isFeatureEnabled } = useAuth();
  const t = useT();
  const isEs = t.lang === "es";

  const availableProviders = useMemo(() => listProviders().filter((provider) => {
    const flagKey = `gps.provider.${provider.id}`;
    return isFeatureEnabled(flagKey, true);
  }), [isFeatureEnabled]);

  const [providerId, setProviderId] = useState(editing?.provider || availableProviders[0]?.id || "flespi");
  const [label, setLabel] = useState(editing?.label || "");
  const [fields, setFields] = useState(() => ({
    token: editing?.token || "",
    baseUrl: editing?.baseUrl || "",
  }));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setProviderId(editing?.provider || availableProviders[0]?.id || "flespi");
    setLabel(editing?.label || "");
    setFields({ token: editing?.token || "", baseUrl: editing?.baseUrl || "" });
    setErrors({});
    setTestResult(null);
  }, [open, editing, availableProviders]);

  const provider = getProvider(providerId);

  const validate = () => {
    const nextErrors = {};
    if (!label.trim()) nextErrors.label = isEs ? "Requerido" : "Required";
    if (!fields.token?.trim()) nextErrors.token = isEs ? "Requerido" : "Required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleTest = async () => {
    if (!provider) return;
    setTesting(true);
    setTestResult(null);
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
      token: fields.token.trim(),
      baseUrl: fields.baseUrl.trim(),
      extra: editing?.extra || {},
      isActive: editing?.isActive ?? true,
    });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{editing ? (isEs ? "Editar proveedor" : "Edit provider") : (isEs ? "Nuevo proveedor GPS" : "New GPS provider")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{isEs ? "Conecta la plataforma GPS de esta empresa." : "Connect this company's GPS platform."}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{isEs ? "Plataforma" : "Platform"}</label>
            <select
              className="form-select"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              disabled={!!editing}
            >
              {availableProviders.map((item) => (
                <option key={item.id} value={item.id}>{item.logoEmoji} {item.label}</option>
              ))}
            </select>
          </div>

          {provider && (
            <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22 }}>{provider.logoEmoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{provider.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{provider.description}</div>
              </div>
              <a href={provider.website} target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {isEs ? "Sitio" : "Website"} <ExternalLink size={12} />
              </a>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{isEs ? "Etiqueta" : "Label"}</label>
            <input className="form-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={isEs ? "Ej: Flota principal" : "E.g. Main fleet"} />
            {errors.label && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{errors.label}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">{isEs ? "Token" : "Token"}</label>
            <div style={{ position: "relative" }}>
              <input
                className="form-input"
                type={showToken ? "text" : "password"}
                value={fields.token}
                onChange={(event) => setFields((current) => ({ ...current, token: event.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowToken((current) => !current)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.token && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{errors.token}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">{isEs ? "URL base" : "Base URL"}</label>
            <input className="form-input" value={fields.baseUrl} onChange={(event) => setFields((current) => ({ ...current, baseUrl: event.target.value }))} placeholder={provider?.fields?.find((field) => field.key === "baseUrl")?.placeholder || "https://..."} />
          </div>

          <button className="btn btn-secondary" onClick={handleTest} disabled={testing || !fields.token.trim()} style={{ justifyContent: "center" }}>
            {testing ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {isEs ? "Probando..." : "Testing..."}</> : <><Zap size={14} /> {isEs ? "Probar conexion" : "Test connection"}</>}
          </button>

          {testResult && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: `1px solid ${testResult.ok ? "rgba(15,158,106,0.2)" : "rgba(220,38,38,0.2)"}`, background: testResult.ok ? "var(--accent-green-light)" : "var(--accent-red-light)", color: testResult.ok ? "var(--accent-green)" : "var(--accent-red)", display: "flex", alignItems: "center", gap: 8 }}>
              {testResult.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              <span style={{ fontSize: 13 }}>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{isEs ? "Cancelar" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {isEs ? "Guardando..." : "Saving..."}</> : <><Save size={14} /> {isEs ? "Guardar proveedor" : "Save provider"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeviceProvisionModal({ open, onClose, providerRecord, editing, onSave }) {
  const t = useT();
  const isEs = t.lang === "es";
  const provider = providerRecord ? getProvider(providerRecord.provider) : null;
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [resultError, setResultError] = useState("");
  const [registerInPlatform, setRegisterInPlatform] = useState(true);

  useEffect(() => {
    if (!open || !provider) return;
    const nextForm = {};
    (provider.provisionFields || []).forEach((field) => {
      nextForm[field.key] = editing?.platformPayload?.[field.key] || editing?.[field.key] || "";
    });
    nextForm.notes = editing?.notes || nextForm.notes || "";
    setForm(nextForm);
    setErrors({});
    setResultMessage("");
    setResultError("");
    setRegisterInPlatform(!editing?.externalId);
  }, [open, provider, editing]);

  const validate = () => {
    const nextErrors = {};
    (provider?.provisionFields || []).forEach((field) => {
      if (field.required && !String(form[field.key] || "").trim()) {
        nextErrors[field.key] = isEs ? "Requerido" : "Required";
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!provider || !providerRecord) return;
    if (!validate()) return;

    setSaving(true);
    setResultError("");
    setResultMessage("");

    try {
      let registration = {
        externalId: editing?.externalId || "",
        deviceId: form.uniqueId || form.deviceId,
        name: form.name,
        platformPayload: { ...form },
      };

      if (registerInPlatform && provider.registerDevice) {
        registration = await provider.registerDevice(form, {
          token: providerRecord.token,
          baseUrl: providerRecord.baseUrl,
          extra: providerRecord.extra || {},
        });
        setResultMessage(isEs ? "Dispositivo registrado en la plataforma correctamente." : "Device registered successfully in the platform.");
      }

      await onSave({
        id: editing?.id,
        providerId: providerRecord.id,
        externalId: registration.externalId || "",
        deviceId: registration.deviceId || form.uniqueId || form.deviceId,
        name: registration.name || form.name,
        notes: form.notes || "",
        platformPayload: {
          ...(editing?.platformPayload || {}),
          ...form,
          ...(registration.platformPayload || {}),
        },
      });

      onClose();
    } catch (error) {
      setResultError(error.message || (isEs ? "No se pudo registrar el dispositivo." : "The device could not be registered."));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !provider || !providerRecord) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{editing ? (isEs ? "Editar dispositivo GPS" : "Edit GPS device") : (isEs ? "Registrar dispositivo GPS" : "Register GPS device")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{provider.logoEmoji} {provider.label}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={registerInPlatform} onChange={(event) => setRegisterInPlatform(event.target.checked)} />
            {isEs ? "Registrar tambien en la plataforma externa" : "Register directly in the external platform"}
          </label>

          {(provider.provisionFields || []).map((field) => (
            <div key={field.key} className="form-group">
              <label className="form-label">{field.label}{field.required ? " *" : ""}</label>
              <input
                className="form-input"
                type={field.type === "number" ? "number" : "text"}
                value={form[field.key] || ""}
                placeholder={field.placeholder || ""}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
              />
              {errors[field.key] && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>{errors[field.key]}</span>}
            </div>
          ))}

          {resultError && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", background: "var(--accent-red-light)", color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} />
              <span style={{ fontSize: 13 }}>{resultError}</span>
            </div>
          )}

          {resultMessage && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(15,158,106,0.2)", background: "var(--accent-green-light)", color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={15} />
              <span style={{ fontSize: 13 }}>{resultMessage}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{isEs ? "Cancelar" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {isEs ? "Guardando..." : "Saving..."}</> : <><Cpu size={14} /> {isEs ? "Guardar dispositivo" : "Save device"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandingSection() {
  const { branding, saveBranding } = useSettings();
  const { company } = useAuth();
  const t = useT();
  const isEs = t.lang === "es";
  const [appName, setAppName] = useState(branding?.appName || "");
  const [appSubtitle, setAppSubtitle] = useState(branding?.appSubtitle || "");
  const [themeColor, setThemeColor] = useState(branding?.themeColor || "#0f1f38");
  const [preview, setPreview] = useState(branding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAppName(branding?.appName || "");
    setAppSubtitle(branding?.appSubtitle || "");
    setThemeColor(branding?.themeColor || "#0f1f38");
    setPreview(branding);
  }, [branding]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const assets = await buildBrandingAssetSet(file);
    setPreview((current) => ({
      ...current,
      ...assets,
      appName,
      appSubtitle,
      themeColor,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveBranding({
      ...preview,
      appName: appName.trim() || company?.name || "Gestion de Activos",
      appSubtitle: appSubtitle.trim(),
      themeColor,
    });
    setSaving(false);
    setMessage(isEs ? "Branding actualizado para esta empresa." : "Branding updated for this company.");
    window.setTimeout(() => setMessage(""), 2500);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Palette size={18} color="var(--accent-blue)" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{isEs ? "Branding de empresa" : "Company branding"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{isEs ? "Logo, favicon y manifest PWA aislados por cliente." : "Logo, favicon and PWA manifest isolated per client."}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="form-group">
          <label className="form-label">{isEs ? "Nombre de la app" : "App name"}</label>
          <input className="form-input" value={appName} onChange={(event) => setAppName(event.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">{isEs ? "Subtitulo" : "Subtitle"}</label>
          <input className="form-input" value={appSubtitle} onChange={(event) => setAppSubtitle(event.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">{isEs ? "Color principal" : "Theme color"}</label>
          <input className="form-input" type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} style={{ minHeight: 44 }} />
        </div>

        <div className="form-group">
          <label className="form-label">{isEs ? "Logo" : "Logo"}</label>
          <label className="btn btn-secondary" style={{ justifyContent: "center", cursor: "pointer" }}>
            <ImagePlus size={14} /> {isEs ? "Subir imagen" : "Upload image"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleFile} />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 18 }}>
        {[
          { label: "Header", src: preview?.logoHeader },
          { label: "32x32", src: preview?.logoIcon32 },
          { label: "192x192", src: preview?.logoIcon192 },
          { label: "512x512", src: preview?.logoIcon512 },
        ].map((item) => (
          <div key={item.label} style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: 12, background: "var(--bg-elevated)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>{item.label}</div>
            <div style={{ height: 72, borderRadius: "var(--radius-sm)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {item.src ? <img src={item.src} alt={item.label} style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }} /> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isEs ? "Sin imagen" : "No image"}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {isEs ? "La identidad visual se aplica al header, favicon e instalacion como app solo para esta empresa." : "Visual identity applies to header, favicon and app install only for this company."}
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {isEs ? "Guardando..." : "Saving..."}</> : <><Wand2 size={14} /> {isEs ? "Guardar branding" : "Save branding"}</>}
        </button>
      </div>

      {message && <div style={{ marginTop: 14, fontSize: 13, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={14} /> {message}</div>}
    </div>
  );
}

function FeatureFlagsSection() {
  const { featureFlags, saveFeatureFlags } = useSettings();
  const t = useT();
  const isEs = t.lang === "es";
  const [draft, setDraft] = useState(featureFlags || DEFAULT_COMPANY_FLAGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(featureFlags || DEFAULT_COMPANY_FLAGS);
  }, [featureFlags]);

  const handleSave = async () => {
    setSaving(true);
    await saveFeatureFlags(draft);
    setSaving(false);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Settings size={18} color="var(--accent-blue)" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{isEs ? "Feature flags por empresa" : "Company feature flags"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{isEs ? "Personaliza funciones para un cliente sin impactar a los demas." : "Customize features for one client without affecting the others."}</div>
        </div>
      </div>

      {Object.entries(FEATURE_FLAG_GROUPS).map(([groupKey, items]) => (
        <div key={groupKey} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            {groupKey}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => {
              const enabled = !!draft[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, [item.key]: !current[item.key] }))}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ color: enabled ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{isEs ? item.labelEs : item.labelEn}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{isEs ? item.descriptionEs : item.descriptionEn}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} /> {isEs ? "Guardando..." : "Saving..."}</> : <><Save size={14} /> {isEs ? "Guardar flags" : "Save flags"}</>}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, loading, deleteProvider, toggleActive, providerDevices, saveDevice, deleteDevice } = useSettings();
  const { company, isFeatureEnabled } = useAuth();
  const t = useT();
  const isEs = t.lang === "es";
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [deviceModalState, setDeviceModalState] = useState({ open: false, provider: null, device: null });
  const [showTokens, setShowTokens] = useState({});
  const [expandedProviders, setExpandedProviders] = useState({});

  const visibleProviders = settings.filter((item) => isFeatureEnabled(`gps.provider.${item.provider}`, true));

  const availableProviders = useMemo(() => listProviders().filter((provider) => isFeatureEnabled(`gps.provider.${provider.id}`, true)), [isFeatureEnabled]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.settings.title}</h1>
          <p className="page-subtitle">
            {company?.name
              ? `${isEs ? "Empresa activa" : "Active company"}: ${company.name}`
              : t.settings.subtitle}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingProvider(null); setProviderModalOpen(true); }}>
          <Plus size={14} /> {isEs ? "Nuevo proveedor" : "New provider"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Cpu size={18} color="var(--accent-blue)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{isEs ? "Plataformas GPS de la empresa" : "Company GPS platforms"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{isEs ? "Credenciales y alta directa de dispositivos por tenant." : "Credentials and direct device provisioning by tenant."}</div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /><span>{t.common.loading}</span></div>
        ) : visibleProviders.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <Settings size={42} color="var(--accent-blue)" style={{ opacity: 0.3 }} />
            <p style={{ fontWeight: 700 }}>{isEs ? "No hay proveedores configurados" : "No providers configured"}</p>
            <p>{isEs ? "Agrega Flespi, Wialon o Traccar segun los feature flags activos." : "Add Flespi, Wialon or Traccar depending on enabled feature flags."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleProviders.map((providerRecord) => {
              const provider = getProvider(providerRecord.provider);
              const devices = providerDevices(providerRecord.id);
              const expanded = !!expandedProviders[providerRecord.id];
              const maskedToken = providerRecord.token ? `${providerRecord.token.slice(0, 8)}••••••••${providerRecord.token.slice(-4)}` : "—";

              return (
                <div key={providerRecord.id} style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, background: providerRecord.isActive ? "var(--bg-card)" : "var(--bg-elevated)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: provider ? `${provider.color}18` : "var(--bg-elevated)", border: `1px solid ${provider?.color || "#d0d7e2"}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                      {provider?.logoEmoji || "🔌"}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800 }}>{providerRecord.label}</span>
                        <span className={`badge ${providerRecord.isActive ? "badge-green" : "badge-muted"}`}>{providerRecord.isActive ? (isEs ? "Activo" : "Active") : (isEs ? "Inactivo" : "Inactive")}</span>
                        <span className="badge badge-muted">{provider?.label || providerRecord.provider}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>{showTokens[providerRecord.id] ? providerRecord.token : maskedToken}</span>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowTokens((current) => ({ ...current, [providerRecord.id]: !current[providerRecord.id] }))}>
                          {showTokens[providerRecord.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        {providerRecord.baseUrl && <span>{providerRecord.baseUrl}</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setExpandedProviders((current) => ({ ...current, [providerRecord.id]: !current[providerRecord.id] }))}>
                        <Cpu size={13} /> {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(providerRecord.id)} style={{ color: providerRecord.isActive ? "var(--accent-green)" : "var(--text-muted)" }}>
                        {providerRecord.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditingProvider(providerRecord); setProviderModalOpen(true); }}>
                        {isEs ? "Editar" : "Edit"}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-red)" }} onClick={() => window.confirm(isEs ? `Eliminar "${providerRecord.label}"?` : `Delete "${providerRecord.label}"?`) && deleteProvider(providerRecord.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border-subtle)" }}>
                      {isFeatureEnabled("gps.deviceProvisioning", true) ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{isEs ? "Dispositivos registrados" : "Registered devices"}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                {provider?.registerDevice
                                  ? (isEs ? "Puedes guardar el dispositivo y opcionalmente crearlo en la plataforma externa." : "You can store the device and optionally create it in the external platform.")
                                  : (isEs ? "Este proveedor aun no expone provisionamiento automatico completo." : "This provider does not yet expose full automatic provisioning.")}
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setDeviceModalState({ open: true, provider: providerRecord, device: null })}>
                              <Plus size={13} /> {isEs ? "Registrar dispositivo" : "Register device"}
                            </button>
                          </div>

                          {devices.length === 0 ? (
                            <div style={{ padding: "14px 0", fontSize: 12, color: "var(--text-muted)" }}>
                              {isEs ? "No hay dispositivos guardados para este proveedor." : "No devices saved for this provider."}
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {devices.map((device) => (
                                <div key={device.id} style={{ padding: "12px 14px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Cpu size={14} color="var(--accent-blue)" />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{device.name}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                      ID app: {device.deviceId}{device.externalId ? ` · ID plataforma: ${device.externalId}` : ""}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setDeviceModalState({ open: true, provider: providerRecord, device })}>
                                      {isEs ? "Editar" : "Edit"}
                                    </button>
                                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-red)" }} onClick={() => window.confirm(isEs ? `Eliminar "${device.name}"?` : `Delete "${device.name}"?`) && deleteDevice(device.id)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ padding: "14px 0", fontSize: 12, color: "var(--text-muted)" }}>
                          {isEs ? "El registro directo de dispositivos esta desactivado para esta empresa." : "Direct device provisioning is disabled for this company."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {availableProviders.length > 0 && (
          <div style={{ marginTop: 18, fontSize: 12, color: "var(--text-muted)" }}>
            {isEs ? "Plataformas habilitadas por feature flags: " : "Platforms enabled by feature flags: "}
            {availableProviders.map((provider) => `${provider.logoEmoji} ${provider.label}`).join(" · ")}
          </div>
        )}
      </div>

      {isFeatureEnabled("system.branding", true) && <BrandingSection />}
      {isFeatureEnabled("system.featureFlags", true) && <div style={{ height: 18 }} />}
      {isFeatureEnabled("system.featureFlags", true) && <FeatureFlagsSection />}

      <ProviderFormModal
        open={providerModalOpen}
        onClose={() => { setProviderModalOpen(false); setEditingProvider(null); }}
        editing={editingProvider}
      />

      <DeviceProvisionModal
        open={deviceModalState.open}
        onClose={() => setDeviceModalState({ open: false, provider: null, device: null })}
        providerRecord={deviceModalState.provider}
        editing={deviceModalState.device}
        onSave={saveDevice}
      />
    </div>
  );
}
