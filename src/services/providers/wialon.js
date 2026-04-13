/**
 * Wialon GPS Provider (stub — ready to implement)
 */
const wialOnProvider = {
  id:          "wialon",
  label:       "Wialon",
  logoEmoji:   "📡",
  color:       "#f97316",
  website:     "https://wialon.com",
  description: "Plataforma de rastreo GPS de Gurtam (Wialon Hosting / Local)",
  fields: [
    { key:"token",   label:"Token de Sesión", type:"password", placeholder:"Wialon session token", required:true },
    { key:"baseUrl", label:"URL del servidor",type:"text",     placeholder:"https://hst-api.wialon.com", required:false },
  ],
  async testConnection(cfg) {
    try {
      const base = cfg?.baseUrl || "https://hst-api.wialon.com";
      const res  = await fetch(`${base}/wialon/ajax.html?svc=core/search_items&params={}&sid=${cfg?.token}`);
      if (res.status === 401) return { ok:false, message:"Token inválido (401)" };
      if (!res.ok)            return { ok:false, message:`Error ${res.status}` };
      return { ok:true, message:"Conexión exitosa con Wialon" };
    } catch (e) {
      return { ok:false, message:`Error de red: ${e.message}` };
    }
  },
  async fetchTelemetry(deviceId, cfg) {
    return { isEmpty:true, _note:"Wialon provider not yet implemented" };
  },
  async fetchMessages(deviceId, limit, cfg) {
    return [];
  },
};
export default wialOnProvider;
