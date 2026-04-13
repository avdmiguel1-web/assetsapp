import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useApp } from "../../stores/AppContext";
import { useT } from "../../i18n/index.jsx";
import { downloadSpreadsheetXml, parseSpreadsheetXml } from "../../lib/spreadsheet";
import { isRemoteUrl, normalizeRemoteAssetUrl, normalizeRemoteFile } from "../../lib/remoteFiles";

const HEADERS = [
  "ID ACTIVO",
  "PLACA/SERIAL",
  "MARCA",
  "MODELO",
  "CATEGORIA",
  "ESTADO",
  "UBICACION REGISTRADA",
  "DESCRIPCION",
  "FOTO DEL ACTIVO",
  "DOCUMENTOS GENERALES",
  "FACTURA DE COMPRA",
  "REGISTRO DE REPARACIONES",
  "ACCESORIOS",
];

const TEMPLATE_ROW = [
  "ACT-001",
  "ABC-123",
  "TOYOTA",
  "HILUX",
  "VEHICULOS (FLOTA)",
  "OPERATIVO",
  "ALMACEN PRINCIPAL",
  "UNIDAD ASIGNADA A OPERACIONES",
  "foto-activo.jpg",
  "manual.pdf|garantia.pdf",
  "factura-compra.pdf",
  "reparacion-enero.pdf",
  "kit-accesorios.pdf",
];

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount >= commaCount ? "\t" : ",";
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => String(cell || "").trim() !== ""));
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .trim()
    .replace(/^'+/, "")
    .toUpperCase();
}

function normalizeLookup(value) {
  return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function splitCellReferences(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const urlRegex = /(https?:\/\/[^\s|;,]+|www\.[^\s|;,]+)/gi;
  const urls = [...text.matchAll(urlRegex)].map((match) => match[0].trim()).filter(Boolean);
  const remainder = text.replace(urlRegex, "\n");
  const locals = remainder
    .split(/\s*(?:\||;|\n|,)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return [...urls, ...locals];
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeReference(value) {
  return String(value ?? "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^'+/, "");
}

function extractReferenceName(value) {
  const normalized = normalizeReference(value);
  if (!normalized) return "";

  if (isRemoteUrl(normalized)) {
    try {
      const url = new URL(normalized);
      const pathname = safeDecode(url.pathname || "");
      const segments = pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1] || "";
      return lastSegment || normalized;
    } catch {
      return normalized;
    }
  }

  const cleaned = safeDecode(normalized.replace(/^file:\/\//i, "").split(/[?#]/)[0]);
  const segments = cleaned.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || cleaned;
}

function getBaseName(value) {
  const name = extractReferenceName(value);
  return name.replace(/\.[^.]+$/, "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function buildLocalFileRegistry(files) {
  const registry = new Map();
  files.forEach((file) => {
    const aliases = new Set([
      normalizeLookup(file.name),
      normalizeLookup(getBaseName(file.name)),
    ].filter(Boolean));

    aliases.forEach((key) => {
      if (!registry.has(key)) registry.set(key, []);
      registry.get(key).push(file);
    });
  });
  return registry;
}

function mergeSelectedFiles(previousFiles, incomingFiles) {
  const merged = [...previousFiles];
  incomingFiles.forEach((file) => {
    const exists = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
    if (!exists) merged.push(file);
  });
  return merged;
}

async function resolveLocalReference(reference, registry, rowNumber) {
  const referenceName = extractReferenceName(reference);
  const exactKey = normalizeLookup(referenceName);
  const baseKey = normalizeLookup(getBaseName(referenceName));
  const matches = [
    ...(registry.get(exactKey) || []),
    ...(baseKey && baseKey !== exactKey ? (registry.get(baseKey) || []) : []),
  ].filter((file, index, list) => list.findIndex((item) => item.name === file.name && item.size === file.size) === index);

  if (!matches.length) {
    throw new Error(`Fila ${rowNumber}: no se encontro el archivo local ${referenceName}. Adjuntalo antes de importar.`);
  }
  if (matches.length > 1) {
    throw new Error(`Fila ${rowNumber}: hay varios archivos locales con el nombre ${referenceName}. Renombralos para evitar ambiguedad.`);
  }

  const [file] = matches;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    data: await readFileAsDataUrl(file),
  };
}

async function resolveAttachmentReferences(value, registry, rowNumber) {
  const references = splitCellReferences(value);
  const files = [];

  for (const reference of references) {
    if (isRemoteUrl(reference)) {
      files.push(normalizeRemoteFile({
        name: extractReferenceName(reference) || "archivo",
        url: normalizeRemoteAssetUrl(reference),
        type: "",
        size: 0,
      }));
      continue;
    }

    files.push(await resolveLocalReference(reference, registry, rowNumber));
  }

  return files;
}

async function resolvePhotoReference(value, registry, rowNumber) {
  const reference = normalizeReference(value);
  if (!reference) return null;
  if (isRemoteUrl(reference)) return normalizeRemoteAssetUrl(reference);
  const localFile = await resolveLocalReference(reference, registry, rowNumber);
  return localFile.data;
}

function canonicalMatch(options, value) {
  const normalized = normalizeLookup(value);
  return options.find((item) => normalizeLookup(item) === normalized) || null;
}

function isTemplateExampleRow(row = [], headerMap = []) {
  return HEADERS.every((header, index) => {
    const rowValue = String(row[headerMap.indexOf(header)] ?? "").trim();
    const templateValue = String(TEMPLATE_ROW[index] ?? "").trim();
    return rowValue === templateValue;
  });
}

export default function BulkImportModal({ open, onClose }) {
  const t = useT();
  const { addAsset, locations, CATEGORIES, STATUSES, assets } = useApp();
  const inputRef = useRef(null);
  const attachmentsRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [localFiles, setLocalFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setLocalFiles([]);
    setBusy(false);
    setError("");
    setReport(null);
    if (attachmentsRef.current) attachmentsRef.current.value = "";
  }, [open]);

  const existingKeys = useMemo(() => {
    const keys = new Set();
    assets.forEach((asset) => {
      const key = `${normalizeLookup(asset.assetId)}|${normalizeLookup(asset.country)}`;
      if (asset.assetId && asset.country) keys.add(key);
    });
    return keys;
  }, [assets]);

  const localFileRegistry = useMemo(() => buildLocalFileRegistry(localFiles), [localFiles]);
  const duplicateLocalNames = useMemo(
    () => [...localFileRegistry.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([, files]) => files[0]?.name || ""),
    [localFileRegistry]
  );

  const handleLocalFilesChange = (event) => {
    const incomingFiles = Array.from(event.target.files || []);
    setLocalFiles((current) => mergeSelectedFiles(current, incomingFiles));
    if (attachmentsRef.current) attachmentsRef.current.value = "";
  };

  const removeLocalFile = (fileToRemove) => {
    setLocalFiles((current) => current.filter((file) => !(file.name === fileToRemove.name && file.size === fileToRemove.size && file.lastModified === fileToRemove.lastModified)));
  };

  const downloadTemplate = () => {
    downloadSpreadsheetXml("plantilla-activos-excel.xml", [
      {
        name: "Plantilla Activos",
        columnWidth: 25,
        rowHeight: 30,
        rows: [HEADERS],
      },
      {
        name: "Ayuda",
        columnWidth: 25,
        rowHeight: 30,
        rows: [
          ["CAMPO", "INDICACION"],
          ["ID ACTIVO", "OBLIGATORIO. SE IMPORTA COMO TEXTO PARA CONSERVAR CEROS INICIALES."],
          ["PLACA/SERIAL", "OBLIGATORIO. SE IMPORTA COMO TEXTO."],
          ["MARCA", "OBLIGATORIO."],
          ["MODELO", "OBLIGATORIO."],
          ["CATEGORIA", "OBLIGATORIO. DEBE EXISTIR EN EL SISTEMA."],
          ["ESTADO", "OPCIONAL. VALORES VALIDOS: OPERATIVO, MANTENIMIENTO, BAJA."],
          ["UBICACION REGISTRADA", "OBLIGATORIO. DEBE EXISTIR EN EL SISTEMA."],
          ["DESCRIPCION", "OPCIONAL."],
          ["FOTO DEL ACTIVO", "OPCIONAL. USA UNA URL PUBLICA O EL NOMBRE DEL ARCHIVO LOCAL SELECCIONADO EN EL PASO 3."],
          ["DOCUMENTOS / FACTURA / REPARACIONES / ACCESORIOS", "OPCIONAL. USA URLS PUBLICAS O NOMBRES DE ARCHIVO SEPARADOS POR |, coma, ; o salto de linea."],
        ],
      },
    ]);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setReport(null);
    setFileName(file.name);

    try {
      if (duplicateLocalNames.length) {
        throw new Error(`Hay archivos locales repetidos: ${duplicateLocalNames.join(", ")}. Renombralos antes de importar.`);
      }

      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, "");
      const rows = file.name.toLowerCase().endsWith(".xml")
        ? parseSpreadsheetXml(cleanText)
        : parseDelimited(cleanText, detectDelimiter(cleanText));
      if (!rows.length) throw new Error("La plantilla esta vacia.");

      const headerMap = rows[0].map((value) => normalizeText(value));
      const missingHeaders = HEADERS.filter((header) => !headerMap.includes(header));
      if (missingHeaders.length) {
        throw new Error(`Faltan columnas obligatorias en la plantilla: ${missingHeaders.join(", ")}`);
      }

      const results = [];
      const seenKeys = new Set(existingKeys);
      let skippedExamples = 0;

      for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        const getValue = (header) => row[headerMap.indexOf(header)] ?? "";
        const rowNumber = index + 1;

        if (isTemplateExampleRow(row, headerMap)) {
          skippedExamples += 1;
          continue;
        }

        const requiredPreview = [
          getValue("ID ACTIVO"),
          getValue("PLACA/SERIAL"),
          getValue("MARCA"),
          getValue("MODELO"),
          getValue("CATEGORIA"),
          getValue("UBICACION REGISTRADA"),
        ].map((value) => String(value ?? "").trim());

        if (requiredPreview.every((value) => !value)) {
          continue;
        }

        try {
          const rawLocation = getValue("UBICACION REGISTRADA");
          const location = locations.find((item) => normalizeLookup(item.name) === normalizeLookup(rawLocation));
          if (!location) throw new Error(`Ubicacion no encontrada: ${rawLocation || "VACIA"}`);

          const category = canonicalMatch(CATEGORIES, getValue("CATEGORIA"));
          if (!category) throw new Error(`Categoria no encontrada: ${getValue("CATEGORIA") || "VACIA"}`);

          const status = canonicalMatch(STATUSES, getValue("ESTADO")) || "Operativo";
          const assetId = normalizeText(getValue("ID ACTIVO"));
          const plate = normalizeText(getValue("PLACA/SERIAL"));
          const brand = normalizeText(getValue("MARCA"));
          const model = normalizeText(getValue("MODELO"));
          const description = normalizeText(getValue("DESCRIPCION"));

          if (!assetId || !plate || !brand || !model || !location.id) {
            throw new Error("La fila no cumple los campos obligatorios.");
          }

          const duplicateKey = `${normalizeLookup(assetId)}|${normalizeLookup(location.country)}`;
          if (seenKeys.has(duplicateKey)) {
            throw new Error(`Ya existe un activo con ID ${assetId} en ${location.country}`);
          }

          await addAsset({
            assetId,
            plate,
            brand,
            model,
            category,
            status,
            locationId: location.id,
            location: location.name,
            country: location.country,
            description,
            hasTelemetry: false,
            flespiDeviceId: "",
            gpsProvider: "",
            profilePhoto: await resolvePhotoReference(getValue("FOTO DEL ACTIVO"), localFileRegistry, rowNumber),
            docs: await resolveAttachmentReferences(getValue("DOCUMENTOS GENERALES"), localFileRegistry, rowNumber),
            invoices: await resolveAttachmentReferences(getValue("FACTURA DE COMPRA"), localFileRegistry, rowNumber),
            repairs: await resolveAttachmentReferences(getValue("REGISTRO DE REPARACIONES"), localFileRegistry, rowNumber),
            accessories: await resolveAttachmentReferences(getValue("ACCESORIOS"), localFileRegistry, rowNumber),
          });

          seenKeys.add(duplicateKey);
          results.push({ row: rowNumber, ok: true, message: `${assetId} importado correctamente.` });
        } catch (rowError) {
          results.push({ row: rowNumber, ok: false, message: rowError.message || "Error desconocido." });
        }
      }

      const ok = results.filter((item) => item.ok).length;
      const failed = results.length - ok;
      if (!results.length && skippedExamples > 0) {
        setReport({
          total: 0,
          ok: 0,
          failed: 0,
          results: [{
            row: 2,
            ok: true,
            message: "Se omitio automaticamente la fila de ejemplo de la plantilla. Completa tus datos y vuelve a importar.",
          }],
        });
        return;
      }

      if (!results.length) {
        throw new Error("La plantilla no contiene filas con datos para importar.");
      }

      setReport({ total: results.length, ok, failed, results });
    } catch (e) {
      setError(e.message || "No se pudo procesar la plantilla.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{t.lang === "en" ? "Bulk Import" : "Carga Masiva"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {t.lang === "en"
                ? "Use an Excel-style template with text-formatted columns."
                : "Usa una plantilla estilo Excel con columnas en formato texto."}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ background: "var(--bg-elevated)", boxShadow: "none", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.lang === "en" ? "1. Download template" : "1. Descarga la plantilla"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 480 }}>
                  {t.lang === "en"
                    ? "The file opens as a normal spreadsheet and keeps columns as text. For photos and documents, use public URLs or local filenames."
                    : "El archivo abre como una hoja normal y mantiene las columnas como texto. Para fotos y documentos usa URLs publicas o nombres de archivos locales."}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={downloadTemplate}>
                <Download size={14} /> {t.lang === "en" ? "Download Excel XML Template" : "Descargar Plantilla Excel XML"}
              </button>
            </div>
          </div>

          <div className="card" style={{ background: "var(--bg-elevated)", boxShadow: "none", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.lang === "en" ? "2. Upload completed file" : "2. Sube el archivo completado"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {fileName || (t.lang === "en" ? "No file selected yet." : "Todavia no has seleccionado un archivo.")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xml,.tsv,.txt,.csv,text/tab-separated-values,text/csv,application/xml,text/xml"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
                  <Upload size={14} /> {busy ? (t.lang === "en" ? "Importing..." : "Importando...") : (t.lang === "en" ? "Select File" : "Seleccionar Archivo")}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: "var(--bg-elevated)", boxShadow: "none", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.lang === "en" ? "3. Attach local files and images" : "3. Adjunta archivos e imagenes locales"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 520 }}>
                  {t.lang === "en"
                    ? "Optional. Write the file name in the spreadsheet cell and select the same files here before importing. You can attach several files at once."
                    : "Opcional. Escribe el nombre del archivo en la celda de la plantilla y selecciona esos mismos archivos aqui antes de importar. Puedes adjuntar varios archivos al mismo tiempo."}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                  {localFiles.length
                    ? `${localFiles.length} ${t.lang === "en" ? "local file(s) ready." : "archivo(s) local(es) listo(s)."}` 
                    : (t.lang === "en" ? "No local files selected." : "No hay archivos locales seleccionados.")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  ref={attachmentsRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={handleLocalFilesChange}
                />
                <button className="btn btn-secondary" onClick={() => attachmentsRef.current?.click()} disabled={busy}>
                  <Upload size={14} /> {t.lang === "en" ? "Select Local Files" : "Seleccionar Archivos Locales"}
                </button>
              </div>
            </div>
            {!!localFiles.length && (
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {localFiles.map((file) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--bg-card)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {Math.max(1, Math.round(file.size / 1024))} KB
                    </span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeLocalFile(file)} disabled={busy}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!!duplicateLocalNames.length && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--accent-red)" }}>
                {t.lang === "en"
                  ? `Duplicate local filenames detected: ${duplicateLocalNames.join(", ")}. Rename them before importing.`
                  : `Se detectaron nombres de archivos locales repetidos: ${duplicateLocalNames.join(", ")}. Renombralos antes de importar.`}
              </div>
            )}
          </div>

          <div className="card" style={{ background: "var(--bg-elevated)", boxShadow: "none", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              <div><strong>{t.lang === "en" ? "Required columns:" : "Columnas obligatorias:"}</strong> ID ACTIVO, PLACA/SERIAL, MARCA, MODELO, CATEGORIA, UBICACION REGISTRADA.</div>
              <div><strong>{t.lang === "en" ? "Status:" : "Estado:"}</strong> {STATUSES.join(", ")}</div>
              <div><strong>{t.lang === "en" ? "Recommended:" : "Recomendado:"}</strong> {t.lang === "en" ? "keep the file as Excel XML to preserve text columns with leading zeros" : "mantener el archivo como Excel XML para conservar columnas en texto con ceros iniciales"}</div>
              <div><strong>{t.lang === "en" ? "Files:" : "Archivos:"}</strong> {t.lang === "en" ? "use public URLs or local filenames. For multiple documents, separate values with |, comma, ; or a line break and select the local files in step 3." : "usa URLs publicas o nombres de archivo locales. Para varios documentos separa los valores con |, coma, ; o salto de linea y selecciona los archivos locales en el paso 3."}</div>
              <div><strong>{t.lang === "en" ? "Telemetry:" : "Telemetria:"}</strong> {t.lang === "en" ? "is intentionally excluded from bulk import" : "queda excluida intencionalmente de la carga masiva"}</div>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--accent-red)", fontSize: 12 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {report && (
            <div className="card" style={{ boxShadow: "none", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  {t.lang === "en" ? "Import summary" : "Resumen de importacion"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {report.ok} {t.lang === "en" ? "successful" : "correctas"} · {report.failed} {t.lang === "en" ? "failed" : "fallidas"}
                </div>
              </div>
              <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {report.results.map((item) => (
                  <div
                    key={`${item.row}-${item.message}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      background: item.ok ? "#f0fdf4" : "#fef2f2",
                      color: item.ok ? "#166534" : "#991b1b",
                      fontSize: 12,
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <strong>{t.lang === "en" ? "Row" : "Fila"} {item.row}</strong>
                    <span>{item.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
