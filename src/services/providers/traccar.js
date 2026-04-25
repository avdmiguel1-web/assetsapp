function getBaseUrl(cfg) {
  return (cfg?.baseUrl || "https://demo.traccar.org").replace(/\/$/, "");
}

async function requestTraccar(cfg, path, options = {}) {
  const response = await fetch(`${getBaseUrl(cfg)}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cfg?.token || ""}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Traccar ${response.status}: ${response.statusText}`);
  }
  return data;
}

const traccarProvider = {
  id: "traccar",
  label: "Traccar",
  logoEmoji: "🗺",
  color: "#7c3aed",
  website: "https://www.traccar.org",
  description: "Plataforma open-source de rastreo GPS (self-hosted o cloud)",
  fields: [
    { key: "token", label: "Token de API", type: "password", placeholder: "Traccar API token", required: true },
    { key: "baseUrl", label: "URL del servidor", type: "text", placeholder: "https://demo.traccar.org", required: true },
  ],
  provisionFields: [
    { key: "name", label: "Nombre del dispositivo", type: "text", required: true, placeholder: "Ej: Camion VE-01" },
    { key: "uniqueId", label: "Unique ID / IMEI", type: "text", required: true, placeholder: "Ej: 867530900000001" },
    { key: "model", label: "Modelo", type: "text", required: false, placeholder: "Opcional" },
    { key: "phone", label: "Telefono / SIM", type: "text", required: false, placeholder: "Opcional" },
    { key: "category", label: "Categoria", type: "text", required: false, placeholder: "vehicle / asset / person" },
    { key: "notes", label: "Notas internas", type: "text", required: false, placeholder: "Opcional" },
  ],
  async testConnection(cfg) {
    try {
      await requestTraccar(cfg, "/api/session", { method: "GET" });
      return { ok: true, message: "Conexion exitosa con Traccar" };
    } catch (error) {
      return { ok: false, message: error.message || "No se pudo validar el token de Traccar." };
    }
  },
  async fetchTelemetry() {
    return { isEmpty: true, _note: "Traccar provider not yet implemented" };
  },
  async fetchMessages() {
    return [];
  },
  async registerDevice(payload, cfg) {
    const created = await requestTraccar(cfg, "/api/devices", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        uniqueId: payload.uniqueId,
        model: payload.model || undefined,
        phone: payload.phone || undefined,
        category: payload.category || undefined,
      }),
    });

    return {
      externalId: String(created?.id || ""),
      deviceId: created?.uniqueId || payload.uniqueId,
      name: created?.name || payload.name,
      platformPayload: created || {},
    };
  },
};

export default traccarProvider;
