/**
 * Componente de diagnóstico — muestra en pantalla el estado de Supabase.
 * Agrégalo temporalmente en App.jsx, verifica, y luego lo eliminas.
 */
import { useEffect, useState } from "react";
import { supabase, isOnline } from "../../lib/supabase";

export default function SupabaseDiag() {
  const [status, setStatus] = useState("checking");
  const [detail, setDetail] = useState("");
  const [insertTest, setInsertTest] = useState(null);

  useEffect(() => {
    async function run() {
      // 1. ¿Está el cliente inicializado?
      if (!isOnline()) {
        setStatus("offline");
        setDetail("supabase es null — las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están cargadas. ¿Reiniciaste el servidor después de crear el .env?");
        return;
      }

      // 2. ¿Puede hacer un SELECT?
      const { data, error } = await supabase.from("assets").select("id").limit(1);
      if (error) {
        setStatus("error");
        setDetail(`SELECT falló: ${error.message} (code: ${error.code})`);
        return;
      }

      // 3. ¿Puede hacer un INSERT de prueba?
      const testId = "DIAG-" + Date.now();
      const { error: insErr } = await supabase.from("assets").insert([{
        id: testId, brand: "TEST", model: "DIAG",
        category: "Equipos de TI", status: "Operativo",
      }]);

      if (insErr) {
        setStatus("insert-error");
        setDetail(`INSERT falló: ${insErr.message} (code: ${insErr.code})`);
        setInsertTest("❌ falló");
        return;
      }

      // 4. Limpia el registro de prueba
      await supabase.from("assets").delete().eq("id", testId);
      setStatus("ok");
      setInsertTest("✅ exitoso — registro guardado y eliminado");
      setDetail("Todo funciona correctamente.");
    }
    run();
  }, []);

  const colors = {
    checking:     "#6b7280",
    offline:      "#dc2626",
    error:        "#dc2626",
    "insert-error": "#d97706",
    ok:           "#059669",
  };

  const labels = {
    checking:     "⏳ Verificando...",
    offline:      "❌ OFFLINE — Supabase no inicializado",
    error:        "❌ Error de conexión",
    "insert-error":"⚠️ Conectado pero INSERT falló",
    ok:           "✅ Supabase conectado y funcionando",
  };

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 9999,
      background: "#1e293b", borderRadius: 12, padding: "14px 18px",
      maxWidth: 420, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)", color: "#f1f5f9",
    }}>
      <div style={{ fontWeight: 700, color: colors[status], marginBottom: 6, fontSize: 13 }}>
        {labels[status]}
      </div>

      <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
        <div>URL: <span style={{ color: "#e2e8f0" }}>{import.meta.env.VITE_SUPABASE_URL || "⚠ NO DEFINIDA"}</span></div>
        <div>KEY: <span style={{ color: "#e2e8f0" }}>{import.meta.env.VITE_SUPABASE_ANON_KEY ? "✅ definida (" + import.meta.env.VITE_SUPABASE_ANON_KEY.slice(0,20) + "...)" : "⚠ NO DEFINIDA"}</span></div>
        {insertTest && <div style={{ marginTop: 4 }}>INSERT test: <span style={{ color: "#e2e8f0" }}>{insertTest}</span></div>}
        {detail && <div style={{ marginTop: 6, color: "#fbbf24", whiteSpace: "pre-wrap" }}>{detail}</div>}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "#475569" }}>
        Elimina &lt;SupabaseDiag /&gt; de App.jsx cuando todo esté OK.
      </div>
    </div>
  );
}
