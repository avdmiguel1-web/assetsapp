function escapeXml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnLetter(index) {
  let result = "";
  let current = index + 1;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    result = String.fromCharCode(65 + modulo) + result;
    current = Math.floor((current - modulo) / 26);
  }
  return result;
}

function createCell(value, styleId) {
  const safeValue = value == null ? "" : String(value);
  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="String">${escapeXml(safeValue)}</Data></Cell>`;
}

function charactersToSpreadsheetWidth(value) {
  const chars = Number(value) || 25;
  return Math.round(chars * 7);
}

function cellContainsMultipleReferences(value = "") {
  const text = String(value || "");
  const urlMatches = text.match(/https?:\/\/[^\s,;|]+/gi) || [];
  if (urlMatches.length > 1) return true;
  return /(\||;|\n|,(?=\s*(?:https?:\/\/|www\.|file:\/\/|[A-Za-z0-9_\-])))/.test(text);
}

export function createSpreadsheetXml({ sheets }) {
  const worksheets = sheets
    .map((sheet) => {
      const maxColumns = Math.max(0, ...(sheet.rows || []).map((row) => row.length));
      const columnWidth = sheet.columnWidth ?? 25;
      const rowHeight = sheet.rowHeight ?? 30;
      const spreadsheetColumnWidth = charactersToSpreadsheetWidth(columnWidth);
      const columns = Array.from({ length: maxColumns }, (_, index) => `<Column ss:Index="${index + 1}" ss:AutoFitWidth="0" ss:Width="${sheet.widths?.[index] || spreadsheetColumnWidth}" ss:StyleID="text"/>`).join("");
      const rows = (sheet.rows || [])
        .map((row, rowIndex) => {
          const styleId = rowIndex === 0 ? "header" : "text";
          const cells = row.map((cell) => createCell(cell, styleId)).join("");
          return `<Row ss:StyleID="${styleId}" ss:AutoFitHeight="0" ss:Height="${rowHeight}">${cells}</Row>`;
        })
        .join("");
      const freezePane = maxColumns
        ? `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><Panes><Pane><Number>3</Number></Pane><Pane><Number>2</Number><ActiveRow>1</ActiveRow><ActiveCol>1</ActiveCol></Pane></Panes></WorksheetOptions>`
        : "";
      return `<Worksheet ss:Name="${escapeXml(sheet.name || "Hoja1")}"><Table ss:DefaultColumnWidth="${spreadsheetColumnWidth}" ss:DefaultRowHeight="${rowHeight}">${columns}${rows}</Table>${freezePane}</Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Codex</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="header">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/>
   </Borders>
   <NumberFormat ss:Format="@"/>
  </Style>
  <Style ss:ID="text">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DBEAFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DBEAFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DBEAFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DBEAFE"/>
   </Borders>
   <NumberFormat ss:Format="@"/>
  </Style>
 </Styles>
 ${worksheets}
</Workbook>`;
}

export function downloadSpreadsheetXml(filename, sheets) {
  const xml = createSpreadsheetXml({ sheets });
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xml") ? filename : `${filename}.xml`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseSpreadsheetXml(text) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("No se pudo leer el archivo de hoja de calculo.");

  const worksheet = xml.getElementsByTagName("Worksheet")[0];
  if (!worksheet) return [];

  const rows = Array.from(worksheet.getElementsByTagName("Row")).map((rowNode) => {
    const cells = [];
    Array.from(rowNode.getElementsByTagName("Cell")).forEach((cellNode) => {
      const indexAttr = cellNode.getAttribute("ss:Index") || cellNode.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Index");
      if (indexAttr) {
        const targetIndex = Number(indexAttr) - 1;
        while (cells.length < targetIndex) cells.push("");
      }
      const hrefAttr =
        cellNode.getAttribute("ss:HRef") ||
        cellNode.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "HRef");
      const formulaAttr =
        cellNode.getAttribute("ss:Formula") ||
        cellNode.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Formula");
      const dataNode = cellNode.getElementsByTagName("Data")[0];
      const formulaMatch = String(formulaAttr || "").match(/HYPERLINK\(\"([^\"]+)\"/i);
      const dataText = dataNode?.textContent || "";
      const preferredValue = cellContainsMultipleReferences(dataText)
        ? dataText
        : (hrefAttr || formulaMatch?.[1] || dataText);
      cells.push(preferredValue);
    });
    return cells;
  });

  return rows.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
}

export function buildAssetExportRows(assets) {
  return [
    ["ID ACTIVO", "PLACA/SERIAL", "MARCA", "MODELO", "CATEGORIA", "ESTADO", "PAIS", "UBICACION", "TELEMETRIA", "PROVEEDOR GPS", "DEVICE ID", "DESCRIPCION"],
    ...assets.map((asset) => [
      asset.assetId || "",
      asset.plate || "",
      asset.brand || "",
      asset.model || "",
      asset.category || "",
      asset.status || "",
      asset.country || "",
      asset.location || "",
      asset.hasTelemetry ? "SI" : "NO",
      asset.gpsProvider || "",
      asset.flespiDeviceId || "",
      asset.description || "",
    ]),
  ];
}
