import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug en consola del navegador
console.log("[Supabase] URL:", SUPABASE_URL ? "✅ " + SUPABASE_URL : "❌ MISSING");
console.log("[Supabase] KEY:", SUPABASE_ANON_KEY ? "✅ " + SUPABASE_ANON_KEY.slice(0,20) + "..." : "❌ MISSING");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[Supabase] Faltan variables de entorno — modo offline");
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const isOnline = () => !!supabase;

/** Prueba la conexión e intenta un SELECT simple */
export async function testConnection() {
  if (!supabase) return { ok: false, error: "Cliente Supabase no inicializado — revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env" };
  try {
    const { data, error } = await supabase.from("assets").select("id").limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
