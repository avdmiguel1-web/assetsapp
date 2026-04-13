const MICROSOFT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";

let microsoftTokenCache = {
  accessToken: "",
  expiresAt: 0,
};

function isMicrosoftShareHost(host = "") {
  const normalizedHost = String(host).toLowerCase();
  return normalizedHost.includes("sharepoint.com") || normalizedHost.includes("onedrive.live.com") || normalizedHost === "1drv.ms";
}

function isDropboxHost(host = "") {
  const normalizedHost = String(host).toLowerCase();
  return normalizedHost.includes("dropbox.com") || normalizedHost.includes("dropboxusercontent.com");
}

function getProvider(targetUrl) {
  if (isMicrosoftShareHost(targetUrl.hostname)) return "microsoft";
  if (isDropboxHost(targetUrl.hostname)) return "dropbox";
  return "direct";
}

function buildDropboxTargetUrl(rawUrl, download = false) {
  const url = new URL(rawUrl);
  if (url.hostname.toLowerCase().includes("dropboxusercontent.com")) {
    return url.toString();
  }

  url.searchParams.delete("dl");
  url.searchParams.delete("raw");
  if (download) url.searchParams.set("dl", "1");
  else url.searchParams.set("raw", "1");
  return url.toString();
}

function getMicrosoftCredentials() {
  const tenantId = process.env.MS_TENANT_ID || process.env.MICROSOFT_TENANT_ID || "";
  const clientId = process.env.MS_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MS_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "";
  return { tenantId, clientId, clientSecret };
}

function hasMicrosoftCredentials() {
  const { tenantId, clientId, clientSecret } = getMicrosoftCredentials();
  return !!tenantId && !!clientId && !!clientSecret;
}

function encodeMicrosoftShareUrl(rawUrl) {
  const base64 = Buffer.from(rawUrl, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `u!${base64}`;
}

async function getMicrosoftAccessToken() {
  const now = Date.now();
  if (microsoftTokenCache.accessToken && microsoftTokenCache.expiresAt > now + 60_000) {
    return microsoftTokenCache.accessToken;
  }

  const { tenantId, clientId, clientSecret } = getMicrosoftCredentials();
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("La integracion de Microsoft Graph no esta configurada en Vercel.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: MICROSOFT_GRAPH_SCOPE,
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || "No se pudo obtener un token de Microsoft Graph.");
  }

  const expiresIn = Number(payload.expires_in || 3600);
  microsoftTokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return microsoftTokenCache.accessToken;
}

async function fetchMicrosoftDriveItem(rawUrl) {
  const token = await getMicrosoftAccessToken();
  const shareId = encodeMicrosoftShareUrl(rawUrl);
  const metadataResponse = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const metadata = await metadataResponse.json().catch(() => ({}));
  if (!metadataResponse.ok) {
    throw new Error(metadata?.error?.message || "Microsoft Graph no pudo resolver el enlace compartido.");
  }

  if (metadata?.folder) {
    throw new Error("Los enlaces a carpetas no tienen vista previa embebida. Comparte el archivo directamente.");
  }

  const contentResponse = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem/content`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
    },
    redirect: "follow",
  });

  if (!contentResponse.ok) {
    throw new Error(`Microsoft Graph no pudo descargar el archivo (${contentResponse.status}).`);
  }

  return {
    upstream: contentResponse,
    fileName: metadata?.name || "",
    contentType: metadata?.file?.mimeType || "",
  };
}

async function fetchDirectFile(targetUrl, extraHeaders = {}) {
  return fetch(targetUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "fleetcore-asset-management/1.0",
      Accept: "*/*",
      ...extraHeaders,
    },
  });
}

async function resolveRemoteFile(targetUrl, options) {
  const provider = getProvider(targetUrl);

  if (provider === "dropbox") {
    const upstream = await fetchDirectFile(new URL(buildDropboxTargetUrl(targetUrl.toString(), options.download)));
    return {
      provider,
      upstream,
      fileName: options.fileName,
      contentType: options.forcedType,
    };
  }

  if (provider === "microsoft") {
    if (hasMicrosoftCredentials()) {
      const resolved = await fetchMicrosoftDriveItem(targetUrl.toString());
      return {
        provider,
        upstream: resolved.upstream,
        fileName: resolved.fileName || options.fileName,
        contentType: options.forcedType || resolved.contentType,
      };
    }

    const upstream = await fetchDirectFile(targetUrl);
    return {
      provider,
      upstream,
      fileName: options.fileName,
      contentType: options.forcedType,
    };
  }

  const upstream = await fetchDirectFile(targetUrl);
  return {
    provider,
    upstream,
    fileName: options.fileName,
    contentType: options.forcedType,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rawUrl = Array.isArray(req.query?.src) ? req.query.src[0] : req.query?.src;
  const fileName = Array.isArray(req.query?.name) ? req.query.name[0] : req.query?.name;
  const forcedType = Array.isArray(req.query?.type) ? req.query.type[0] : req.query?.type;
  const download = (Array.isArray(req.query?.download) ? req.query.download[0] : req.query?.download) === "1";

  if (!rawUrl) {
    return res.status(400).json({ error: "Missing src query parameter." });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid src URL." });
  }

  if (!/^https?:$/i.test(targetUrl.protocol)) {
    return res.status(400).json({ error: "Unsupported protocol." });
  }

  try {
    const { provider, upstream, fileName: resolvedFileName, contentType: resolvedType } = await resolveRemoteFile(targetUrl, {
      fileName,
      forcedType,
      download,
    });

    const contentType = resolvedType || upstream.headers.get("content-type") || "application/octet-stream";
    const finalUrl = upstream.url ? new URL(upstream.url) : targetUrl;

    if (!upstream.ok) {
      if (provider === "microsoft" && (upstream.status === 401 || upstream.status === 403 || finalUrl.hostname.includes("login.microsoftonline.com"))) {
        return res.status(409).json({
          error: hasMicrosoftCredentials()
            ? "Microsoft Graph no pudo acceder al archivo compartido. Verifica permisos Files.Read.All y Sites.Read.All con consentimiento de administrador."
            : "Configura MS_TENANT_ID, MS_CLIENT_ID y MS_CLIENT_SECRET en Vercel para resolver enlaces privados de OneDrive y SharePoint desde la app.",
        });
      }

      return res.status(upstream.status).json({ error: `Remote server responded with ${upstream.status}.` });
    }

    if (provider === "microsoft" && /^text\/html\b/i.test(contentType)) {
      return res.status(409).json({
        error: hasMicrosoftCredentials()
          ? "Microsoft Graph resolvio el enlace, pero el origen devolvio HTML en lugar del archivo."
          : "El enlace de OneDrive devolvio una pagina HTML. Configura Microsoft Graph para resolver enlaces privados o usa un enlace publico directo.",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = String(resolvedFileName || fileName || "").replace(/"/g, "");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Remote-Provider", provider);

    if (safeName) {
      res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${safeName}"`);
    } else {
      res.setHeader("Content-Disposition", download ? "attachment" : "inline");
    }

    return res.status(200).send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected proxy error.";
    return res.status(500).json({ error: message });
  }
}
