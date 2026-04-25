function getBaseUrl(cfg) {
  return (cfg?.baseUrl || "https://hst-api.wialon.com").replace(/\/$/, "");
}

async function requestWialon(cfg, service, params, sid = "") {
  const baseUrl = getBaseUrl(cfg);
  const url = new URL(`${baseUrl}/wialon/ajax.html`);
  url.searchParams.set("svc", service);
  url.searchParams.set("params", JSON.stringify(params || {}));
  if (sid) url.searchParams.set("sid", sid);

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Wialon ${response.status}: ${response.statusText}`);
  }
  if (data?.error) {
    throw new Error(typeof data.error === "string" ? data.error : `Wialon error ${data.error}`);
  }
  return data;
}

async function loginWithToken(cfg) {
  const payload = await requestWialon(cfg, "token/login", { token: cfg?.token || "", operateAs: "" });
  return {
    sid: payload?.eid || "",
    user: payload?.user || null,
  };
}

async function logout(cfg, sid) {
  if (!sid) return;
  try {
    await requestWialon(cfg, "core/logout", {}, sid);
  } catch {
    // Ignore cleanup errors.
  }
}

const wialOnProvider = {
  id: "wialon",
  label: "Wialon",
  logoEmoji: "📡",
  color: "#f97316",
  website: "https://wialon.com",
  description: "Plataforma de rastreo GPS de Gurtam (Wialon Hosting / Local)",
  fields: [
    { key: "token", label: "Token de sesion", type: "password", placeholder: "Wialon token", required: true },
    { key: "baseUrl", label: "URL del servidor", type: "text", placeholder: "https://hst-api.wialon.com", required: false },
  ],
  provisionFields: [
    { key: "name", label: "Nombre de la unidad", type: "text", required: true, placeholder: "Ej: Camion VE-01" },
    { key: "uniqueId", label: "Unique ID / IMEI", type: "text", required: true, placeholder: "Ej: 867530900000001" },
    { key: "creatorId", label: "Creator ID", type: "number", required: true, placeholder: "ID del recurso / cuenta" },
    { key: "hardwareTypeId", label: "Hardware type ID", type: "number", required: true, placeholder: "Ej: 16" },
    { key: "notes", label: "Notas internas", type: "text", required: false, placeholder: "Opcional" },
  ],
  async testConnection(cfg) {
    try {
      const session = await loginWithToken(cfg);
      await logout(cfg, session.sid);
      return { ok: true, message: "Conexion exitosa con Wialon" };
    } catch (error) {
      return { ok: false, message: error.message || "No se pudo validar el token de Wialon." };
    }
  },
  async fetchTelemetry() {
    return { isEmpty: true, _note: "Wialon provider not yet implemented" };
  },
  async fetchMessages() {
    return [];
  },
  async registerDevice(payload, cfg) {
    const session = await loginWithToken(cfg);
    try {
      const created = await requestWialon(cfg, "core/create_unit", {
        creatorId: Number(payload.creatorId),
        name: payload.name,
        hwTypeId: Number(payload.hardwareTypeId),
        dataFlags: 0,
      }, session.sid);

      const unitId = created?.item?.id || created?.id || created?.itemId;
      if (!unitId) {
        throw new Error("Wialon no devolvio el ID de la unidad creada.");
      }

      await requestWialon(cfg, "unit/update_device_type", {
        itemId: Number(unitId),
        deviceTypeId: Number(payload.hardwareTypeId),
        uniqueId: payload.uniqueId,
      }, session.sid);

      return {
        externalId: String(unitId),
        deviceId: payload.uniqueId,
        name: payload.name,
        platformPayload: created || {},
      };
    } finally {
      await logout(cfg, session.sid);
    }
  },
};

export default wialOnProvider;
