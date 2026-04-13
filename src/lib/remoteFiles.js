const REMOTE_TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const SHAREPOINT_KIND_MAP = {
  i: { type: "image/jpeg", extension: "jpg", label: "imagen" },
  b: { type: "application/pdf", extension: "pdf", label: "documento" },
  x: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", label: "hoja-calculo" },
  w: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx", label: "documento" },
  p: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx", label: "presentacion" },
};

export function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value ?? "").trim());
}

function isMicrosoftShareHost(host = "") {
  const normalizedHost = String(host).toLowerCase();
  return normalizedHost.includes("sharepoint.com") || normalizedHost.includes("onedrive.live.com") || normalizedHost === "1drv.ms";
}

function isDropboxHost(host = "") {
  const normalizedHost = String(host).toLowerCase();
  return normalizedHost.includes("dropbox.com") || normalizedHost.includes("dropboxusercontent.com");
}

export function isMicrosoftShareUrl(value) {
  const input = String(value ?? "").trim();
  if (!isRemoteUrl(input)) return false;

  try {
    const url = new URL(input);
    return isMicrosoftShareHost(url.hostname);
  } catch {
    return false;
  }
}

export function isDropboxUrl(value) {
  const input = String(value ?? "").trim();
  if (!isRemoteUrl(input)) return false;

  try {
    const url = new URL(input);
    return isDropboxHost(url.hostname);
  } catch {
    return false;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && !!window.location;
}

function getExtension(name = "") {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
}

function decodePathname(pathname = "") {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function inferSharePointKind(url) {
  const match = String(url?.pathname || "").match(/\/:([a-z]):\//i);
  return match?.[1]?.toLowerCase() || "";
}

function inferNameFromUrl(url) {
  const pathname = decodePathname(url.pathname || "");
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

function looksLikeOpaqueShareName(name = "") {
  return !name || !name.includes(".") || /^[A-Za-z0-9_-]{12,}$/.test(name);
}

function buildFriendlyRemoteName(url, fallbackName = "") {
  const directName = fallbackName || inferNameFromUrl(url);
  const sharePointKind = inferSharePointKind(url);
  const mapped = SHAREPOINT_KIND_MAP[sharePointKind];

  if (!mapped) return directName || "archivo";
  if (!looksLikeOpaqueShareName(directName)) return directName;

  return `${mapped.label}.${mapped.extension}`;
}

function inferRemoteType(url, name = "", currentType = "") {
  if (currentType) return currentType;

  const directExt = getExtension(name) || getExtension(inferNameFromUrl(url));
  if (directExt && REMOTE_TYPE_BY_EXTENSION[directExt]) return REMOTE_TYPE_BY_EXTENSION[directExt];

  const sharePointKind = inferSharePointKind(url);
  return SHAREPOINT_KIND_MAP[sharePointKind]?.type || "";
}

export function inferRemoteTypeFromValue(value, fallbackName = "", currentType = "") {
  const sourceUrl = extractOriginalRemoteUrl(value);
  if (!isRemoteUrl(sourceUrl)) return currentType || "";

  try {
    const url = new URL(sourceUrl);
    const name = buildFriendlyRemoteName(url, fallbackName);
    return inferRemoteType(url, name, currentType);
  } catch {
    return currentType || "";
  }
}

function normalizeRemoteDescriptor(file) {
  if (!file) return null;
  if (typeof file === "string") {
    const trimmed = file.trim();
    if (!trimmed) return null;
    return {
      name: "",
      url: trimmed,
      sourceUrl: trimmed,
      type: "",
      size: 0,
    };
  }
  return file;
}

export function normalizeRemoteAssetUrl(value) {
  const input = String(value ?? "").trim();
  if (!isRemoteUrl(input)) return input;

  try {
    const url = new URL(input);
    return url.toString();
  } catch {
    return input;
  }
}

export function extractOriginalRemoteUrl(value) {
  const input = String(value ?? "").trim();
  if (!input) return input;

  try {
    const url = new URL(input, isBrowser() ? window.location.origin : "http://localhost");
    const isProxyPath = url.pathname.endsWith("/api/remote-file") || url.pathname === "/api/remote-file";
    const source = url.searchParams.get("src");
    if (isProxyPath && source) return normalizeRemoteAssetUrl(source);
  } catch {
    return input;
  }

  return normalizeRemoteAssetUrl(input);
}

function normalizeProxyTargetUrl(value) {
  const input = String(value ?? "").trim();
  if (!isRemoteUrl(input)) return input;

  try {
    const url = new URL(input);
    if (isMicrosoftShareHost(url.hostname)) {
      url.searchParams.delete("web");
      url.searchParams.set("download", "1");
    }
    return url.toString();
  } catch {
    return input;
  }
}

export function shouldProxyRemoteUrl(value) {
  const sourceUrl = extractOriginalRemoteUrl(value);
  return isMicrosoftShareUrl(sourceUrl) || isDropboxUrl(sourceUrl);
}

export function buildRemoteProxyUrl(value, name = "", options = {}) {
  const sourceUrl = extractOriginalRemoteUrl(value);
  if (!isRemoteUrl(sourceUrl) || !shouldProxyRemoteUrl(sourceUrl)) return sourceUrl;

  const params = new URLSearchParams({ src: normalizeProxyTargetUrl(sourceUrl) });
  if (name) params.set("name", name);
  if (options.type) params.set("type", options.type);
  if (options.download) params.set("download", "1");

  if (isBrowser()) return `${window.location.origin}/api/remote-file?${params.toString()}`;
  return `/api/remote-file?${params.toString()}`;
}

export function toDisplayableRemoteUrl(value, name = "", options = {}) {
  const sourceUrl = extractOriginalRemoteUrl(value);
  if (!isRemoteUrl(sourceUrl)) return sourceUrl;
  if (!shouldProxyRemoteUrl(sourceUrl)) return sourceUrl;
  return buildRemoteProxyUrl(sourceUrl, name, options);
}

export function normalizeRemoteFile(file) {
  const normalizedFile = normalizeRemoteDescriptor(file);
  if (!normalizedFile?.url && !normalizedFile?.sourceUrl) return file;

  try {
    const sourceUrl = extractOriginalRemoteUrl(normalizedFile.sourceUrl || normalizedFile.url);
    const url = new URL(sourceUrl);
    const name = buildFriendlyRemoteName(url, normalizedFile.name);
    const type = inferRemoteType(url, name, normalizedFile.type);
    const shouldProxy = shouldProxyRemoteUrl(sourceUrl);
    const displayUrl = shouldProxy
      ? toDisplayableRemoteUrl(sourceUrl, name, { type })
      : sourceUrl;
    const downloadUrl = shouldProxy
      ? buildRemoteProxyUrl(sourceUrl, name, { type, download: true })
      : (normalizedFile.downloadUrl || sourceUrl);

    return {
      ...normalizedFile,
      name,
      sourceUrl,
      type,
      url: displayUrl,
      downloadUrl,
    };
  } catch {
    const sourceUrl = extractOriginalRemoteUrl(normalizedFile.sourceUrl || normalizedFile.url);
    const shouldProxy = shouldProxyRemoteUrl(sourceUrl);
    return {
      ...normalizedFile,
      sourceUrl,
      url: shouldProxy
        ? toDisplayableRemoteUrl(sourceUrl, normalizedFile.name, { type: normalizedFile.type })
        : sourceUrl,
      downloadUrl: shouldProxy
        ? buildRemoteProxyUrl(sourceUrl, normalizedFile.name, { type: normalizedFile.type, download: true })
        : (normalizedFile.downloadUrl || sourceUrl),
    };
  }
}

export function normalizeRemoteFileList(files = []) {
  return files
    .map((file) => normalizeRemoteFile(file))
    .filter(Boolean);
}
