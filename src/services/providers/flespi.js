/**
 * Flespi GPS Provider
 * Implements the IProvider interface for Flespi.io
 */

const IS_DEV = import.meta.env.DEV;

function getBase(cfg) {
  return IS_DEV ? "/flespi/gw" : (cfg?.baseUrl || "https://flespi.io/gw");
}

function getHeaders(cfg) {
  const token = cfg?.token;
  const h = { Accept: "application/json" };
  if (!IS_DEV && token) h["Authorization"] = `FlespiToken ${token}`;
  return h;
}

async function apiFetch(path, cfg) {
  const res = await fetch(`${getBase(cfg)}${path}`, { headers: getHeaders(cfg) });
  if (!res.ok) throw new Error(`Flespi ${res.status}: ${res.statusText}`);
  return res.json();
}

async function apiWrite(path, cfg, method, payload) {
  const res = await fetch(`${getBase(cfg)}${path}`, {
    method,
    headers: {
      ...getHeaders(cfg),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.reason || `Flespi ${res.status}: ${res.statusText}`);
  }
  return data;
}

function parseMessage(msg) {
  if (!msg) return { isEmpty: true };
  return {
    isEmpty:        false,
    timestamp:      msg.timestamp,
    ignitionOn:     msg["engine.ignition.status"] === true || msg["engine.ignition.status"] === 1,
    ignition:       msg["engine.ignition.status"] ?? null,
    speed:          msg["position.speed"]         ?? null,
    latitude:       msg["position.latitude"]      ?? null,
    longitude:      msg["position.longitude"]     ?? null,
    satellites:     msg["position.satellites"]    ?? null,
    direction:      msg["position.direction"]     ?? null,
    posValid:       msg["position.valid"]         ?? false,
    hasPosition:    msg["position.latitude"] != null && msg["position.longitude"] != null,
    batteryVoltage: msg["battery.voltage"]        ?? null,
    batteryLevel:   msg["battery.level"]          ?? null,
    gsmSignalDbm:   msg["gsm.signal.dbm"]         ?? null,
  };
}

const flespiProvider = {
  id:         "flespi",
  label:      "Flespi",
  logoEmoji:  "🛰",
  color:      "#1d6fef",
  website:    "https://flespi.io",
  description:"Plataforma IoT para rastreo GPS (Sinotrack, Concox, Teltonika y más)",

  // Fields shown in the Settings form for this provider
  fields: [
    { key:"token",   label:"Token de API",   type:"password", placeholder:"FlespiToken XXXX...", required:true },
    { key:"baseUrl", label:"URL Base",       type:"text",     placeholder:"https://flespi.io/gw (opcional)", required:false },
  ],
  provisionFields: [
    { key: "name", label: "Nombre del dispositivo", type: "text", required: true, placeholder: "Ej: Camion VE-01" },
    { key: "uniqueId", label: "IMEI / Ident", type: "text", required: true, placeholder: "Ej: 867530900000001" },
    { key: "deviceTypeId", label: "ID de tipo de dispositivo", type: "number", required: true, placeholder: "Ej: 1234" },
    { key: "phone", label: "Telefono / SIM", type: "text", required: false, placeholder: "Opcional" },
    { key: "notes", label: "Notas internas", type: "text", required: false, placeholder: "Opcional" },
  ],

  /** Test if token is valid — tries to list devices */
  async testConnection(cfg) {
    try {
      const base = IS_DEV ? "/flespi/gw" : (cfg?.baseUrl || "https://flespi.io/gw");
      const headers = { Accept: "application/json" };
      if (!IS_DEV && cfg?.token) headers["Authorization"] = `FlespiToken ${cfg.token}`;
      const res = await fetch(`${base}/devices/all`, { headers });
      if (res.status === 401) return { ok: false, message: "Token inválido — acceso denegado (401)" };
      if (res.status === 429) return { ok: false, message: "Límite de solicitudes alcanzado (429) — intenta en unos segundos" };
      if (!res.ok)            return { ok: false, message: `Error ${res.status}: ${res.statusText}` };
      const data = await res.json();
      const count = Array.isArray(data?.result) ? data.result.length : "?";
      return { ok: true, message: `Conexión exitosa — ${count} dispositivo(s) encontrado(s)` };
    } catch (e) {
      return { ok: false, message: `Error de red: ${e.message}` };
    }
  },

  /** Fetch latest telemetry for a device */
  async fetchTelemetry(deviceId, cfg) {
    const now = Math.floor(Date.now() / 1000);
    const tryFrom = async (from) => {
      const json = await apiFetch(`/devices/${deviceId}/messages?from=${from}`, cfg);
      return Array.isArray(json?.result) ? json.result : [];
    };
    let msgs = await tryFrom(now - 600);
    if (!msgs.length) msgs = await tryFrom(now - 7200);
    if (!msgs.length) msgs = await tryFrom(now - 86400);
    return parseMessage(msgs[msgs.length - 1]);
  },

  /** Fetch message history for a device */
  async fetchMessages(deviceId, limit = 300, cfg) {
    const now  = Math.floor(Date.now() / 1000);
    const json = await apiFetch(`/devices/${deviceId}/messages?from=${now - 7 * 86400}`, cfg);
    const all  = Array.isArray(json?.result) ? json.result : [];
    return all.slice(-limit).map(parseMessage);
  },

  async registerDevice(payload, cfg) {
    const response = await apiWrite("/devices", cfg, "POST", [{
      name: payload.name,
      device_type_id: Number(payload.deviceTypeId),
      configuration: {
        ident: payload.uniqueId,
        phone: payload.phone || undefined,
      },
    }]);

    const result = Array.isArray(response?.result) ? response.result[0] : response?.result;
    return {
      externalId: String(result?.id || ""),
      deviceId: payload.uniqueId,
      name: payload.name,
      platformPayload: result || response || {},
    };
  },
};

export default flespiProvider;
