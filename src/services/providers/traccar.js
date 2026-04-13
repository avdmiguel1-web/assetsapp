/**
 * Traccar GPS Provider (stub — ready to implement)
 */
const traccarProvider = {
  id:          "traccar",
  label:       "Traccar",
  logoEmoji:   "🗺",
  color:       "#7c3aed",
  website:     "https://www.traccar.org",
  description: "Plataforma open-source de rastreo GPS (self-hosted o cloud)",
  fields: [
    { key:"token",   label:"Token de API",  type:"password", placeholder:"Traccar API token", required:true },
    { key:"baseUrl", label:"URL del servidor",type:"text",   placeholder:"https://demo.traccar.org", required:true },
  ],
  async testConnection(cfg) {
    try {
      const base = cfg?.baseUrl?.replace(/\/$/, "");
      const res  = await fetch(`${base}/api/session`, {
        headers: { Authorization: `Bearer ${cfg?.token}`, Accept:"application/json" }
      });
      if (res.status === 401) return { ok:false, message:"Token inválido (401)" };
      if (!res.ok)            return { ok:false, message:`Error ${res.status}` };
      return { ok:true, message:"Conexión exitosa con Traccar" };
    } catch (e) {
      return { ok:false, message:`Error de red: ${e.message}` };
    }
  },
  async fetchTelemetry(deviceId, cfg) {
    return { isEmpty:true, _note:"Traccar provider not yet implemented" };
  },
  async fetchMessages(deviceId, limit, cfg) {
    return [];
  },
};
export default traccarProvider;
