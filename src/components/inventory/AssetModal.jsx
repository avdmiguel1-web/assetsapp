import { useEffect, useRef, useState } from "react";
import { useApp } from "../../stores/AppContext";
import { useSettings } from "../../stores/SettingsContext";
import { listProviders } from "../../services/providers/registry";
import { X, Upload, Image, Trash2, Plus, AlertCircle, Receipt, Wrench, Package } from "lucide-react";
import { useT } from "../../i18n/index.jsx";

const BLANK = {
  assetId:"", plate:"", flespiDeviceId:"", hasTelemetry:false,
  gpsProvider:"flespi",
  category:"", brand:"", model:"",
  locationId:"", status:"Operativo",
  statusReason:"",
  description:"", profilePhoto:null,
  docs:[], invoices:[], repairs:[], accessories:[],
};

const STATUS_NEEDS_REASON = ["Mantenimiento", "Baja"];

const PROVIDERS = listProviders();

function toUpperInput(value) {
  return typeof value === "string" ? value.toUpperCase() : value;
}

function fmt(b) {
  if (!b) return "";
  if (b<1024) return `${b} B`;
  if (b<1024*1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
}
function fileIcon(t="") {
  if (t.startsWith("image/")) return "🖼";
  if (t==="application/pdf") return "📄";
  if (t.includes("excel")||t.includes("spreadsheet")) return "📊";
  if (t.includes("word")) return "📝";
  return "📎";
}

function FileSection({ label, icon: Icon, color, files, onAdd, onRemove, inputRef }) {
  const [drag, setDrag] = useState(false);
  const t = useT();
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color, marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
        <Icon size={12}/> {label}
      </div>
      <div style={{ border:`1.5px dashed ${drag?color:"var(--border-default)"}`, borderRadius:"var(--radius-md)", padding:"10px 12px", background:drag?`${color}11`:"var(--bg-elevated)", cursor:"pointer", transition:"var(--transition)", textAlign:"center" }}
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);Array.from(e.dataTransfer.files).forEach(onAdd);}}
        onClick={()=>inputRef.current?.click()}>
        <Upload size={14} color={color} style={{ marginBottom:3, opacity:0.7 }} />
        <div style={{ fontSize:10, color:"var(--text-muted)" }}>{t.assetModal.dragHint}</div>
        <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp" style={{ display:"none" }} onChange={e=>Array.from(e.target.files).forEach(onAdd)} />
      </div>
      {files?.length>0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:6 }}>
          {files.map(f => (
            <div key={f.name} className="file-item">
              <span style={{ fontSize:14 }}>{fileIcon(f.type)}</span>
              <span className="file-item-name" title={f.name}>{f.name}</span>
              <span className="file-item-size">{fmt(f.size)}</span>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ color:"var(--accent-red)", flexShrink:0 }} onClick={()=>onRemove(f.name)}><Trash2 size={11}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssetModal({ open, onClose, editAsset=null }) {
  const t = useT();
  const { addAsset, updateAsset, CATEGORIES, STATUSES, locations, assets } = useApp();
  const { settings, getActiveDevice } = useSettings();
  const isEdit = !!editAsset;
  const [form,   setForm]   = useState(()=>editAsset?{...BLANK,...editAsset}:{...BLANK});
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const photoRef      = useRef();
  const docsRef       = useRef();
  const invoicesRef   = useRef();
  const repairsRef    = useRef();
  const accessoriesRef= useRef();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setUpper = (k, v) => set(k, toUpperInput(v));

  useEffect(() => {
    if (!open) return;
    setForm(editAsset ? { ...BLANK, ...editAsset } : { ...BLANK });
    setErrors({});
    setSaveError("");
    setSaving(false);
  }, [open, editAsset]);

  const handlePhoto = (file) => {
    if (!file?.type.startsWith("image/")) return;
    const r=new FileReader(); r.onload=e=>set("profilePhoto",e.target.result); r.readAsDataURL(file);
  };
  const appendTo = (key) => (file) => {
    const r=new FileReader();
    r.onload=e=>setForm(f=>{
      const arr=f[key]??[];
      if(arr.find(x=>x.name===file.name)) return f;
      return {...f,[key]:[...arr,{name:file.name,size:file.size,type:file.type,data:e.target.result}]};
    });
    r.readAsDataURL(file);
  };
  const removeFrom = (key,name) => setForm(f=>({...f,[key]:(f[key]??[]).filter(x=>x.name!==name)}));

  // Active GPS providers from settings
  const activeProviders = settings.filter(s => s.isActive);
  const activeProviderDevice = getActiveDevice(form.gpsProvider || "flespi");

  const validate = () => {
    const e = {};
    if (!form.assetId.trim()) e.assetId = t.common.required;
    if (!form.plate.trim()) e.plate = t.common.required;
    if (!form.brand.trim()) e.brand = t.common.required;
    if (!form.model.trim()) e.model = t.common.required;
    if (!form.category)     e.category = t.common.required;
    if (!form.locationId)   e.locationId = t.common.required;
    if (STATUS_NEEDS_REASON.includes(form.status) && !form.statusReason?.trim())
      e.statusReason = t.common.required;
    if (form.assetId?.trim()) {
      const country = locations.find(l=>l.id===form.locationId)?.country ?? form.country ?? "";
      if (country) {
        const dup = assets.find(a=>
          a.assetId?.trim().toLowerCase()===form.assetId.trim().toLowerCase() &&
          a.country?.trim().toLowerCase()===country.toLowerCase() &&
          a.id!==(form.id??"")
        );
        if (dup) e.assetId = `${t.assetModal.assetId}: ya existe "${dup.brand} ${dup.model}" en ${country}`;
      }
    }
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveError("");
    setSaving(true);
    const loc = locations.find(l=>l.id===form.locationId);
    const payload = {
      ...form,
      location:  loc?.name    ?? "",
      country:   loc?.country ?? "",
      flespiDeviceId: form.hasTelemetry ? (form.flespiDeviceId || activeProviderDevice?.deviceId || "") : "",
      gpsProvider: form.hasTelemetry ? form.gpsProvider : "",
    };
    try {
      await (isEdit ? updateAsset(payload) : addAsset(payload));
      onClose();
    } catch (e) {
      setSaveError(e.message || "No se pudo guardar el activo.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const fileSections = [
    { key:"docs",        label:t.assetModal.docs,        icon:Package, color:"var(--accent-blue)",   ref:docsRef },
    { key:"invoices",    label:t.assetModal.invoices,    icon:Receipt, color:"var(--accent-green)",  ref:invoicesRef },
    { key:"repairs",     label:t.assetModal.repairs,     icon:Wrench,  color:"var(--accent-amber)",  ref:repairsRef },
    { key:"accessories", label:t.assetModal.accessories, icon:Package, color:"var(--accent-purple)", ref:accessoriesRef },
  ];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit?t.assetModal.titleEdit:t.assetModal.titleNew}</div>
            <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>{isEdit?`${editAsset.brand} ${editAsset.model}`:t.assetModal.subtitleNew}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="modal-body" style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:28 }}>
          {/* LEFT */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div className="form-label" style={{ marginBottom:7 }}>{t.assetModal.photoLabel}</div>
              <div style={{ width:"100%", aspectRatio:"1/1", borderRadius:"var(--radius-lg)", border:"2px dashed var(--border-default)", background:"var(--bg-elevated)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden" }}
                onClick={()=>photoRef.current?.click()}
                onMouseOver={e=>e.currentTarget.style.borderColor="var(--accent-blue)"}
                onMouseOut={e=>e.currentTarget.style.borderColor="var(--border-default)"}>
                {form.profilePhoto?(
                  <img src={form.profilePhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                ):(
                  <>
                    <Image size={28} color="var(--text-muted)" style={{ opacity:0.35, marginBottom:6 }} />
                    <div style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center" }}>{t.assetModal.photoHint}<br/><span style={{ fontSize:10, opacity:0.7 }}>{t.assetModal.photoTypes}</span></div>
                  </>
                )}
                <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handlePhoto(e.target.files[0])} />
              </div>
              {form.profilePhoto&&(
                <button className="btn btn-ghost btn-sm" style={{ marginTop:5, color:"var(--accent-red)", fontSize:11, width:"100%", justifyContent:"center" }} onClick={()=>set("profilePhoto",null)}>
                  <Trash2 size={11}/> {t.assetModal.removePhoto}
                </button>
              )}
            </div>
            <div style={{ height:1, background:"var(--border-subtle)" }} />
            {fileSections.map(s=>(
              <FileSection key={s.key} label={s.label} icon={s.icon} color={s.color}
                files={form[s.key]} onAdd={appendTo(s.key)} onRemove={n=>removeFrom(s.key,n)} inputRef={s.ref} />
            ))}
          </div>

          {/* RIGHT */}
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <SectionTitle>{t.assetModal.identification}</SectionTitle>
            <div className="form-grid">
              <Field label={`${t.assetModal.assetId.replace(" *","")} *`} hint={errors.assetId ? "" : t.common.required} error={errors.assetId}>
                <input className="form-input" placeholder="Ej: VH-001" value={form.assetId} onChange={e=>setUpper("assetId",e.target.value)} />
              </Field>
              <Field label={`${t.assetModal.plate.replace(" *","")} *`} error={errors.plate}>
                <input className="form-input" placeholder="Ej: ABC-123" value={form.plate} onChange={e=>setUpper("plate",e.target.value)} />
              </Field>
            </div>

            {/* Telemetry */}
            <div style={{ background:form.hasTelemetry?"var(--accent-blue-light)":"var(--bg-elevated)", border:`1.5px solid ${form.hasTelemetry?"var(--accent-blue-mid)":"var(--border-default)"}`, borderRadius:"var(--radius-md)", padding:"11px 13px", transition:"var(--transition)" }}>
              <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}>
                <input type="checkbox" checked={form.hasTelemetry} onChange={e=>set("hasTelemetry",e.target.checked)} style={{ width:15, height:15, accentColor:"var(--accent-blue)" }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:form.hasTelemetry?"var(--accent-blue)":"var(--text-primary)" }}>{t.assetModal.telemetry}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{t.assetModal.telemetryHint}</div>
                </div>
              </label>
              {form.hasTelemetry&&(
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:10 }}>
                  {/* Provider selector */}
                  <div className="form-group">
                    <label className="form-label">{t.assetModal.provider}</label>
                    {activeProviders.length > 0 ? (
                      <select className="form-select" value={form.gpsProvider||"flespi"} onChange={e=>set("gpsProvider",e.target.value)}>
                        {activeProviders.map(p=>(
                          <option key={p.id} value={p.provider}>
                            {PROVIDERS.find(pr=>pr.id===p.provider)?.logoEmoji} {p.label} ({PROVIDERS.find(pr=>pr.id===p.provider)?.label||p.provider})
                          </option>
                        ))}
                        <option value="flespi">🛰 Flespi (token .env)</option>
                      </select>
                    ) : (
                      <div style={{ fontSize:12, color:"var(--text-muted)", padding:"7px 10px", background:"var(--bg-panel)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
                        🛰 Flespi · <span style={{ fontSize:11 }}>Configura proveedores en <strong>Configuración</strong></span>
                      </div>
                    )}
                  </div>
                  {/* Device ID */}
                  <div className="form-group">
                    <label className="form-label">{t.assetModal.deviceIdLabel}</label>
                    <input className="form-input" placeholder={`Ej: ${activeProviderDevice?.deviceId || "867530900000001"}`} style={{ fontFamily:"'IBM Plex Mono',monospace" }} value={form.flespiDeviceId} onChange={e=>setUpper("flespiDeviceId",e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <SectionTitle>{t.assetModal.classification}</SectionTitle>
            <div className="form-grid">
              <Field label={t.assetModal.brand} error={errors.brand}><input className="form-input" placeholder="Toyota, Caterpillar..." value={form.brand} onChange={e=>setUpper("brand",e.target.value)} /></Field>
              <Field label={t.assetModal.model} error={errors.model}><input className="form-input" placeholder="Hilux, 320D..." value={form.model} onChange={e=>setUpper("model",e.target.value)} /></Field>
              <Field label={t.assetModal.category} error={errors.category}>
                <select className="form-select" value={form.category} onChange={e=>set("category",e.target.value)}>
                  <option value="">{t.assetModal.selectCategory}</option>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t.assetModal.status}>
                <select className="form-select" value={form.status} onChange={e=>{
                  set("status", e.target.value);
                  if (!STATUS_NEEDS_REASON.includes(e.target.value)) set("statusReason", "");
                }}>
                  {STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {STATUS_NEEDS_REASON.includes(form.status) && (
              <div style={{ background:"#fffbeb", border:"1.5px solid #f59e0b", borderRadius:"var(--radius-md)", padding:"11px 13px", transition:"var(--transition)" }}>
                <Field label={t.assetModal.statusReasonLabel || "Motivo del Estado *"} error={errors.statusReason}>
                  <input
                    className="form-input"
                    placeholder={
                      form.status === "Mantenimiento"
                        ? "Ej: Cambio de cauchos, revisión de motor..."
                        : "Ej: Equipo irreparable, fin de vida útil..."
                    }
                    value={form.statusReason || ""}
                    onChange={e => setUpper("statusReason", e.target.value)}
                  />
                </Field>
              </div>
            )}

            <SectionTitle>{t.assetModal.locationSec}</SectionTitle>
            <Field label={`${t.assetModal.locationLabel.replace(" *","")} *`} error={errors.locationId}>
              {locations.length>0?(
                <select className="form-select" value={form.locationId||""}
                  onChange={e=>{
                    const loc=locations.find(l=>l.id===e.target.value);
                    setForm(f=>({...f,locationId:e.target.value,location:loc?.name||"",country:loc?.country||""}));
                  }}>
                  <option value="">{t.assetModal.locationNone}</option>
                  {locations.map(l=><option key={l.id} value={l.id}>{l.name} — {l.country}</option>)}
                </select>
              ):(
                <div style={{ fontSize:12, color:"var(--text-muted)", padding:"8px 12px", background:"var(--bg-elevated)", borderRadius:"var(--radius-md)", border:"1px dashed var(--border-default)" }}>
                  {t.assetModal.locationEmpty}
                </div>
              )}
            </Field>

            <SectionTitle>{t.assetModal.description}</SectionTitle>
            <textarea className="form-textarea" rows={3} placeholder={t.assetModal.descPlaceholder} value={form.description} onChange={e=>setUpper("description",e.target.value)} />

            {Object.keys(errors).length>0&&(
              <div style={{ display:"flex", gap:6, alignItems:"center", color:"var(--accent-red)", fontSize:12 }}>
                <AlertCircle size={13}/> {t.assetModal.requiredError}
              </div>
            )}
            {saveError && (
              <div style={{ display:"flex", gap:6, alignItems:"center", color:"var(--accent-red)", fontSize:12 }}>
                <AlertCircle size={13}/> {saveError}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>{t.assetModal.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Plus size={14}/>{saving ? "Guardando..." : isEdit?t.assetModal.save:t.assetModal.register}</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({children}){return <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--accent-blue)", borderBottom:"1.5px solid var(--accent-blue-mid)", paddingBottom:5 }}>{children}</div>;}
function Field({label,error,hint,children}){return(<div className="form-group"><label className="form-label">{label}</label>{children}{error&&<span style={{ fontSize:10, color:"var(--accent-red)" }}>{error}</span>}{hint&&!error&&<span style={{ fontSize:10, color:"var(--text-muted)" }}>{hint}</span>}</div>);}
