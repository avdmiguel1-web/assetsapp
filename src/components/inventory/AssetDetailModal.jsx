import { useEffect, useMemo, useState } from "react";
import { X, Pencil, MapPin, Calendar, Tag, FileText, Download, Zap, ZapOff, Satellite, Receipt, Wrench, Package, Eye } from "lucide-react";
import { useTelemetry } from "../../hooks/useTelemetry";
import { useApp } from "../../stores/AppContext";
import ResolvedImage from "../common/ResolvedImage";

const STATUS = { Operativo: "badge-green", Mantenimiento: "badge-amber", Baja: "badge-red" };

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--border-subtle)", gap: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value ?? "—"}</span>
    </div>
  );
}

function fmt(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

function getPreviewKind(file) {
  const type = String(file?.type || "").toLowerCase();
  const ext = getFileExtension(file?.name);
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    type.includes("excel") ||
    type.includes("spreadsheet") ||
    type.includes("word") ||
    type.includes("presentation") ||
    ["xls", "xlsx", "csv", "doc", "docx", "ppt", "pptx"].includes(ext)
  ) return "office";
  return null;
}

function getOfficeViewerUrl(src) {
  const absoluteSrc = toAbsoluteUrl(src);
  if (!/^https?:\/\//i.test(absoluteSrc || "")) return "";
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteSrc)}`;
}

function toAbsoluteUrl(src = "") {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (typeof window === "undefined") return src;
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function getCloudProviderLabel(src = "") {
  if (/(sharepoint\.com|onedrive\.live\.com|1drv\.ms)/i.test(String(src))) return "OneDrive";
  if (/(dropbox\.com|dropboxusercontent\.com)/i.test(String(src))) return "Dropbox";
  return "nube";
}

function PreviewModal({ file, onClose }) {
  const src = file?.url || file?.data || file?.sourceUrl || "";
  const sourceUrl = file?.sourceUrl || src;
  const kind = getPreviewKind(file);
  const downloadSrc = file?.downloadUrl || sourceUrl || src;
  const [previewSrc, setPreviewSrc] = useState(kind === "office" ? src : "");
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    if (!src || kind === "office") {
      setPreviewSrc(src);
      setPreviewError("");
      return undefined;
    }

    if (src.startsWith("data:") || src.startsWith("blob:")) {
      setPreviewSrc(src);
      setPreviewError("");
      return undefined;
    }

    setPreviewSrc("");
    setPreviewError("");

    fetch(src)
      .then(async (response) => {
        if (!response.ok) {
          let errorMessage = `Preview request failed with ${response.status}`;
          try {
            const payload = await response.json();
            if (payload?.error) errorMessage = payload.error;
          } catch {
            // Ignore parse failures and keep the HTTP status message.
          }
          throw new Error(errorMessage);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPreviewSrc(objectUrl);
          setPreviewError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (kind === "image" && sourceUrl && sourceUrl !== src) {
            setPreviewSrc(sourceUrl);
            setPreviewError("");
            return;
          }
          setPreviewSrc("");
          setPreviewError(error?.message || "No se pudo cargar la vista previa.");
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, sourceUrl, src]);

  const officeViewerUrl = useMemo(() => getOfficeViewerUrl(sourceUrl || src), [sourceUrl, src]);
  const cloudProviderLabel = getCloudProviderLabel(sourceUrl);
  const cloudPreviewBlocked = kind !== "office" && cloudProviderLabel !== "nube" && !previewSrc && !!previewError;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ width: "min(1100px, 95vw)", height: "min(760px, 88vh)", background: "#fff", borderRadius: "var(--radius-lg)", overflow: "hidden" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Download size={12} /> Abrir</a>}
            {downloadSrc && <a href={downloadSrc} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Download size={12} /> Descargar</a>}
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div style={{ width: "100%", height: "calc(100% - 58px)", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {kind === "image" && previewSrc && <img src={previewSrc} alt={file?.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
          {kind === "pdf" && previewSrc && <iframe title={file?.name} src={previewSrc} style={{ width: "100%", height: "100%", border: "none" }} />}
          {kind === "office" && officeViewerUrl && <iframe title={file?.name} src={officeViewerUrl} style={{ width: "100%", height: "100%", border: "none" }} />}
          {previewError && !previewSrc && (
            <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 13, maxWidth: 520, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>No se pudo cargar la vista previa.</div>
              <div>{previewError}</div>
              {cloudPreviewBlocked && (
                <div style={{ marginTop: 10 }}>
                  Este enlace de {cloudProviderLabel} parece requerir permisos adicionales o no exponer el archivo directamente. Puedes abrirlo en una pestana nueva o configurar la integracion del proveedor para una vista previa embebida estable.
                </div>
              )}
            </div>
          )}
          {((kind === "office" && !officeViewerUrl) || !kind) && (
            <div style={{ padding: 24, textAlign: "center", color: "#475569", fontSize: 13 }}>
              No hay vista previa embebida para este archivo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileItem({ file }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind = getPreviewKind(file);
  const src = file.url || file.data || file.sourceUrl;
  const previewSource = file.sourceUrl || src;
  const downloadSrc = file.downloadUrl || file.sourceUrl || src;
  const isPreviewable = kind === "image" || kind === "pdf" || (kind === "office" && /^https?:\/\//i.test(toAbsoluteUrl(previewSource) || ""));

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", fontSize: 12, cursor: isPreviewable ? "pointer" : "default" }}
        onClick={() => isPreviewable && setPreviewOpen(true)}
      >
        {kind === "image" && src
          ? <ResolvedImage src={src} alternateSrc={file.sourceUrl} alt={file.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0, border: "1px solid var(--border-subtle)" }} />
          : <span style={{ fontSize: 20, flexShrink: 0 }}>{kind === "pdf" ? "📄" : kind === "office" ? "📊" : "📎"}</span>}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>{file.name}</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{fmt(file.size)}</span>
        {isPreviewable && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={(event) => { event.stopPropagation(); setPreviewOpen(true); }}>
            <Eye size={12} />
          </button>
        )}
        {downloadSrc && (
          <a href={downloadSrc} download={file.name} className="btn btn-ghost btn-icon btn-sm" style={{ color: "var(--accent-blue)", flexShrink: 0 }} onClick={(event) => event.stopPropagation()}>
            <Download size={12} />
          </a>
        )}
      </div>
      {previewOpen && <PreviewModal file={file} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}

function FilesBlock({ title, icon: Icon, color, files }) {
  if (!files?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
        <Icon size={11} /> {title} ({files.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {files.map((file) => <FileItem key={`${file.name}-${file.url || file.data || ""}`} file={file} />)}
      </div>
    </div>
  );
}

export default function AssetDetailModal({ open, onClose, asset, onEdit }) {
  const { FLAG_MAP } = useApp();
  if (!open || !asset) return null;

  const deviceId = asset.hasTelemetry && asset.flespiDeviceId ? String(asset.flespiDeviceId) : null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {asset.profilePhoto && (
              <ResolvedImage src={asset.profilePhoto} alternateSrc={asset.profilePhotoSource} alt={asset.brand} style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0, border: "2px solid var(--border-subtle)" }} />
            )}
            <div>
              <div className="modal-title">{asset.brand} {asset.model}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                <span className={`badge ${STATUS[asset.status] || "badge-muted"}`}>{asset.status}</span>
                <span className="badge badge-muted">{asset.category}</span>
                {asset.hasTelemetry && <span className="badge badge-blue"><Satellite size={10} /> GPS · Device {asset.flespiDeviceId}</span>}
                {asset.plate && <span className="badge badge-muted" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{asset.plate}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onEdit && <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); onEdit(); }}><Pencil size={13} /> Editar</button>}
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div>
            <SectionTitle icon={<Tag size={13} />}>Informacion del Activo</SectionTitle>
            {asset.assetId && <Row label="ID Activo" value={asset.assetId} />}
            <Row label="Placa / Serial" value={asset.plate} />
            <Row label="Marca" value={asset.brand} />
            <Row label="Modelo" value={asset.model} />
            <Row label="Categoria" value={asset.category} />
            <Row label="Estado" value={<span className={`badge ${STATUS[asset.status] || "badge-muted"}`}>{asset.status}</span>} />
            <Row label="Pais" value={`${FLAG_MAP[asset.country] || ""} ${asset.country}`} />
            <Row label="Ubicacion" value={<span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} color="var(--accent-blue)" />{asset.location}</span>} />
            <Row label="Registrado" value={asset.createdAt ? new Date(asset.createdAt).toLocaleString("es-VE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
            {asset.description && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Descripcion</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, background: "var(--bg-elevated)", padding: "10px 12px", borderRadius: "var(--radius-md)" }}>{asset.description}</div>
              </div>
            )}
            <FilesBlock title="Documentos" icon={FileText} color="var(--accent-blue)" files={asset.docs} />
            <FilesBlock title="Facturas de compra" icon={Receipt} color="var(--accent-green)" files={asset.invoices} />
            <FilesBlock title="Reparaciones" icon={Wrench} color="var(--accent-amber)" files={asset.repairs} />
            <FilesBlock title="Accesorios" icon={Package} color="var(--accent-purple)" files={asset.accessories} />
          </div>

          <div>
            {deviceId ? (
              <LiveTelemetry deviceId={deviceId} gpsProvider={asset.gpsProvider || "flespi"} />
            ) : (
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", padding: 20 }}>
                <SectionTitle icon={<Satellite size={13} />}>Telemetria GPS</SectionTitle>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.7 }}>
                  Este activo no tiene telemetria GPS.
                  <br />
                  Editalo y activa <strong>"Tiene Telemetria GPS"</strong> para ver datos en vivo.
                </div>
              </div>
            )}
            {asset.profilePhoto && (
              <div style={{ marginTop: 16 }}>
                <SectionTitle icon={null}>Foto del Activo</SectionTitle>
                <ResolvedImage src={asset.profilePhoto} alternateSrc={asset.profilePhotoSource} alt={asset.brand} style={{ width: "100%", borderRadius: "var(--radius-lg)", objectFit: "cover", maxHeight: 200, marginTop: 8, border: "1px solid var(--border-subtle)" }} />
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function LiveTelemetry({ deviceId, gpsProvider = "flespi" }) {
  const { telemetry, loading, error } = useTelemetry(deviceId, 15000, gpsProvider);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <SectionTitle icon={<Satellite size={13} />}>Telemetria en Vivo</SectionTitle>
        {!error && telemetry && !telemetry.isEmpty && <div className="telemetry-live"><div className="pulse-dot" />LIVE</div>}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
        Device ID: <span style={{ color: "var(--accent-blue)" }}>{deviceId}</span>
      </div>
      {loading && !telemetry && <div className="loading-state"><div className="spinner" /><span>Conectando...</span></div>}
      {error && <div className="error-state">{error}</div>}
      {telemetry && !telemetry.isEmpty && (() => {
        const ignitionOn = telemetry.ignitionOn;
        return (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: ignitionOn ? "var(--accent-green-light)" : "var(--accent-red-light)", border: `1.5px solid ${ignitionOn ? "rgba(15,158,106,0.25)" : "rgba(220,38,38,0.25)"}`, borderRadius: "var(--radius-lg)", marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: ignitionOn ? "rgba(15,158,106,0.15)" : "rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ignitionOn ? <Zap size={20} color="var(--accent-green)" /> : <ZapOff size={20} color="var(--accent-red)" />}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>engine.ignition.status</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: ignitionOn ? "var(--accent-green)" : "var(--accent-red)" }}>{ignitionOn ? "ENCENDIDO" : "APAGADO"}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace" }}>
                {telemetry.batteryVoltage != null && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-amber)" }}>{telemetry.batteryVoltage}V</div>}
                {telemetry.batteryLevel != null && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{telemetry.batteryLevel}%</div>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {/* Velocidad */}
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-blue)", textTransform: "uppercase", marginBottom: 4 }}>Velocidad</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, color: "var(--text-primary)", fontWeight: 600 }}>{telemetry.speed != null ? `${telemetry.speed} km/h` : "—"}</div>
              </div>
              {/*
                COMBUSTIBLE — Visible solo cuando el activo tiene telemetría activa.
                Estado actual: N/A (sin hardware instalado).
                TODO: Integrar con Teltonika FMC150.
                Parámetros Flespi candidatos (AVL codec FMC150):
                  "can.fuel.level"    (AVL ID  50) → % nivel vía CAN bus  [PREFERIDO]
                  "fuel.level.liter"  (AVL ID  48) → litros vía OBD/CAN
                  "can.fuel.used.gps" (AVL ID 223) → consumo acumulado GPS
                Cuando estén disponibles, sustituir "N/A" por:
                  telemetry.fuelLevelPercent != null
                    ? `${telemetry.fuelLevelPercent}%`
                    : telemetry.fuelLevelLiters != null
                      ? `${telemetry.fuelLevelLiters} L`
                      : "N/A"
              */}
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-amber)", textTransform: "uppercase", marginBottom: 4 }}>Combustible</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, color: "var(--text-muted)", fontWeight: 600 }}>
                  {telemetry.fuelLevelPercent != null
                    ? `${telemetry.fuelLevelPercent}%`
                    : telemetry.fuelLevelLiters != null
                      ? `${telemetry.fuelLevelLiters} L`
                      : "N/A"}
                </div>
              </div>
            </div>
            {telemetry.hasPosition && (
              <div style={{ background: "var(--accent-purple-light)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-purple)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Posicion GPS</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{telemetry.latitude}, {telemetry.longitude}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{telemetry.posValid ? "Senal valida" : "Sin validez"}</div>
              </div>
            )}
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={9} />
              {telemetry.timestamp ? new Date(telemetry.timestamp * 1000).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </div>
          </>
        );
      })()}
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-blue)", borderBottom: "1.5px solid var(--accent-blue-mid)", paddingBottom: 6, marginBottom: 12 }}>
      {icon}{children}
    </div>
  );
}
