import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileSpreadsheet, Upload, X, CheckCircle } from "lucide-react";
import { useApp } from "../../stores/AppContext";
import { useT } from "../../i18n/index.jsx";
import { downloadSpreadsheetXml, parseSpreadsheetXml } from "../../lib/spreadsheet";

// ─── Plantilla ───────────────────────────────────────────────────────────────
const HEADERS = [
  "NOMBRE UBICACION",
  "PAIS",
  "DIRECCION",
  "DESCRIPCION",
];

const TEMPLATE_ROWS = [
  ["Almacén Principal", "Venezuela", "Av. Libertador, Caracas", "Almacén central de operaciones"],
  ["Sucursal Norte",   "Colombia",  "Calle 80 #45-12, Bogotá", "Sucursal zona norte"],
  ["Depósito Miami",   "Estados Unidos", "1234 NW 12th Ave, Miami FL", "Depósito logístico"],
];

// ─── Parser de texto delimitado ───────────────────────────────────────────────
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabCount   = (firstLine.match(/\t/g)  || []).length;
  const commaCount = (firstLine.match(/,/g)   || []).length;
  return tabCount >= commaCount ? "\t" : ",";
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let current = "", row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) { row.push(current); current = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current); rows.push(row); row = []; current = "";
      continue;
    }
    current += char;
  }
  if (current || row.length) { row.push(current); rows.push(row); }
  return rows;
}

// ─── Parsear fila → objeto ubicación ─────────────────────────────────────────
function parseLocationRow(row) {
  const get = (i) => (row[i] ?? "").toString().trim();
  const name        = get(0);
  const country     = get(1);
  const address     = get(2);
  const description = get(3);

  const errors = [];
  if (!name)    errors.push("Nombre requerido");
  if (!country) errors.push("País requerido");

  return {
    data: { name, country, address, description },
    errors,
    valid: errors.length === 0,
  };
}

// ─── Parsear archivo (XML, CSV, TSV) ─────────────────────────────────────────
async function parseFile(file) {
  const text = await file.text();
  const ext  = file.name.split(".").pop().toLowerCase();
  let raw = [];

  if (ext === "xml") {
    raw = parseSpreadsheetXml(text);
  } else {
    const delim = detectDelimiter(text);
    raw = parseDelimited(text, delim);
  }

  if (!raw.length) return { rows: [], error: "Archivo vacío o sin datos." };

  // Detectar si primera fila es cabecera
  const first = raw[0].map((c) => c.toString().trim().toUpperCase());
  const isHeader =
    first.includes("NOMBRE UBICACION") ||
    first.includes("NOMBRE") ||
    first.includes("PAIS") ||
    first.includes("COUNTRY");
  const dataRows = isHeader ? raw.slice(1) : raw;

  const rows = dataRows
    .filter((r) => r.some((c) => c.toString().trim()))
    .map((r, i) => ({ rowIndex: i + (isHeader ? 2 : 1), ...parseLocationRow(r) }));

  return { rows, error: null };
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function BulkImportLocationsModal({ open, onClose }) {
  const t = useT();
  const { addLocation, locations, countryOptions } = useApp();

  const [step, setStep]         = useState("upload");  // upload | preview | importing | done
  const [rows, setRows]         = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError]       = useState("");
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped]   = useState([]);
  const inputRef = useRef(null);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("upload"); setRows([]); setFileName("");
        setError(""); setProgress(0); setImported(0); setSkipped([]);
      }, 300);
    }
  }, [open]);

  // Descargar plantilla
  const downloadTemplate = () => {
    downloadSpreadsheetXml("plantilla-ubicaciones.xml", [
      {
        name: "Ubicaciones",
        rows: [HEADERS, ...TEMPLATE_ROWS],
      },
    ]);
  };

  // Manejo de archivo
  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const { rows: parsed, error: parseError } = await parseFile(file);
    if (parseError) { setError(parseError); return; }
    if (!parsed.length) { setError("No se encontraron filas de datos."); return; }
    setRows(parsed);
    setStep("preview");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validRows   = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  // Detectar duplicados contra ubicaciones existentes
  const isDuplicate = (row) =>
    locations.some(
      (loc) =>
        loc.name.trim().toLowerCase()    === row.data.name.trim().toLowerCase() &&
        loc.country.trim().toLowerCase() === row.data.country.trim().toLowerCase()
    );

  const toImport = validRows.filter((r) => !isDuplicate(r));
  const dupes    = validRows.filter((r) =>  isDuplicate(r));

  // Importar
  const runImport = async () => {
    if (!toImport.length) return;
    setStep("importing");
    const skippedRows = [];
    let count = 0;

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        await addLocation({
          name:        row.data.name,
          country:     row.data.country,
          address:     row.data.address,
          description: row.data.description,
        });
        count++;
      } catch {
        skippedRows.push(row);
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImported(count);
    setSkipped(skippedRows);
    setStep("done");
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Carga Masiva de Ubicaciones</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              Importa múltiples ubicaciones desde un archivo Excel, CSV o TSV.
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── PASO 1: UPLOAD ── */}
          {step === "upload" && (
            <>
              {/* Descarga de plantilla */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <FileSpreadsheet size={20} color="var(--accent-green)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Plantilla de ubicaciones</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Descarga y rellena con tus datos</div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                  <Download size={13} /> Descargar
                </button>
              </div>

              {/* Columnas de la plantilla */}
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-secondary)" }}>Columnas requeridas:</strong>{" "}
                {HEADERS.map((h, i) => (
                  <span key={h}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: "var(--bg-elevated)", padding: "1px 6px", borderRadius: 4 }}>{h}</span>
                    {i < HEADERS.length - 1 ? " · " : ""}
                  </span>
                ))}
                <span style={{ marginLeft: 4 }}>— Las dos primeras son obligatorias.</span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{ border: "2px dashed var(--border-default)", borderRadius: "var(--radius-lg)", padding: "36px 24px", textAlign: "center", cursor: "pointer", background: "var(--bg-elevated)", transition: "var(--transition)" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-blue)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
              >
                <Upload size={32} color="var(--accent-blue)" style={{ opacity: 0.5, marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Arrastra tu archivo aquí</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>o haz clic para seleccionar · .xml · .csv · .tsv</div>
                {fileName && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--accent-blue)", fontWeight: 600 }}>📎 {fileName}</div>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".xml,.csv,.tsv,.txt"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />

              {error && (
                <div style={{ display: "flex", gap: 6, color: "var(--accent-red)", fontSize: 12 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}
            </>
          )}

          {/* ── PASO 2: PREVIEW ── */}
          {step === "preview" && (
            <>
              {/* Resumen */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120, padding: "12px 16px", background: "var(--accent-green-light)", borderRadius: "var(--radius-md)", border: "1px solid rgba(15,158,106,0.2)" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-green)" }}>{toImport.length}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Listas para importar</div>
                </div>
                {dupes.length > 0 && (
                  <div style={{ flex: 1, minWidth: 120, padding: "12px 16px", background: "var(--accent-amber-light, rgba(245,158,11,0.1))", borderRadius: "var(--radius-md)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-amber)" }}>{dupes.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Duplicadas (se omitirán)</div>
                  </div>
                )}
                {invalidRows.length > 0 && (
                  <div style={{ flex: 1, minWidth: 120, padding: "12px 16px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-md)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-red)" }}>{invalidRows.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Con errores</div>
                  </div>
                )}
              </div>

              {/* Tabla de vista previa */}
              <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>#</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>Nombre</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>País</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>Dirección</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const dupe = row.valid && isDuplicate(row);
                      const statusColor = !row.valid
                        ? "rgba(239,68,68,0.06)"
                        : dupe
                        ? "rgba(245,158,11,0.06)"
                        : "";
                      return (
                        <tr key={row.rowIndex} style={{ borderBottom: "1px solid var(--border-subtle)", background: statusColor }}>
                          <td style={{ padding: "6px 12px", color: "var(--text-muted)", fontFamily: "'IBM Plex Mono',monospace" }}>{row.rowIndex}</td>
                          <td style={{ padding: "6px 12px", fontWeight: 600 }}>{row.data.name || <span style={{ color: "var(--accent-red)" }}>—</span>}</td>
                          <td style={{ padding: "6px 12px" }}>{row.data.country || <span style={{ color: "var(--accent-red)" }}>—</span>}</td>
                          <td style={{ padding: "6px 12px", color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.data.address || "—"}</td>
                          <td style={{ padding: "6px 12px" }}>
                            {!row.valid
                              ? <span style={{ color: "var(--accent-red)", fontSize: 10, fontWeight: 700 }}>⚠ {row.errors.join(", ")}</span>
                              : dupe
                              ? <span style={{ color: "var(--accent-amber)", fontSize: 10, fontWeight: 700 }}>Duplicada</span>
                              : <span style={{ color: "var(--accent-green)", fontSize: 10, fontWeight: 700 }}>✓ OK</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {toImport.length === 0 && (
                <div style={{ display: "flex", gap: 6, color: "var(--accent-amber)", fontSize: 12 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  No hay ubicaciones válidas para importar. Corrige los errores o elimina duplicados.
                </div>
              )}

              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { setStep("upload"); setRows([]); setFileName(""); }}>
                ← Cambiar archivo
              </button>
            </>
          )}

          {/* ── PASO 3: IMPORTING ── */}
          {step === "importing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Importando ubicaciones…</div>
              <div style={{ width: "100%", background: "var(--bg-elevated)", borderRadius: 99, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent-green)", borderRadius: 99, transition: "width 0.2s" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{progress}% completado</div>
            </div>
          )}

          {/* ── PASO 4: DONE ── */}
          {step === "done" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0", textAlign: "center" }}>
              <CheckCircle size={48} color="var(--accent-green)" style={{ opacity: 0.85 }} />
              <div style={{ fontWeight: 700, fontSize: 16 }}>Importación completada</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--accent-green)" }}>{imported}</strong> ubicación{imported !== 1 ? "es" : ""} importada{imported !== 1 ? "s" : ""} correctamente.
              </div>
              {skipped.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--accent-amber)" }}>
                  {skipped.length} fila{skipped.length !== 1 ? "s" : ""} no se pudo importar por error.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === "upload" && (
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          )}
          {step === "preview" && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={runImport} disabled={toImport.length === 0}>
                <Upload size={14} /> Importar {toImport.length} ubicación{toImport.length !== 1 ? "es" : ""}
              </button>
            </>
          )}
          {step === "done" && (
            <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
          )}
        </div>

      </div>
    </div>
  );
}
