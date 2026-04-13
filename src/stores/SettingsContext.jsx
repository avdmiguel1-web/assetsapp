/**
 * SettingsContext — manages GPS provider configurations
 * Persists to Supabase table `provider_settings`
 * Tokens are AES-encrypted before storage
 */
import { createContext, useContext, useReducer, useEffect, useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { encryptToken, decryptToken } from "../lib/crypto";
import { getProvider } from "../services/providers/registry";

const Ctx = createContext(null);

function genId() {
  return "PRV-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function dbFetch() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("provider_settings").select("*").order("created_at");
  if (error) { console.error("[Settings] fetch:", error.message); return []; }
  // Decrypt tokens
  return Promise.all(data.map(async r => ({
    id:        r.id,
    provider:  r.provider,
    label:     r.label,
    token:     await decryptToken(r.token),
    baseUrl:   r.base_url ?? "",
    extra:     r.extra ?? {},
    isActive:  r.is_active,
    createdAt: r.created_at,
  })));
}

async function dbSave(cfg) {
  if (!supabase) return cfg;
  const encrypted = await encryptToken(cfg.token);
  const row = {
    id:         cfg.id,
    provider:   cfg.provider,
    label:      cfg.label,
    token:      encrypted,
    base_url:   cfg.baseUrl || null,
    extra:      cfg.extra || {},
    is_active:  cfg.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("provider_settings")
    .upsert([row], { onConflict:"id" }).select().single();
  if (error) { console.error("[Settings] save:", error.message); return cfg; }
  return { ...cfg, id: data.id };
}

async function dbDelete(id) {
  if (!supabase) return;
  await supabase.from("provider_settings").delete().eq("id", id);
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case "LOAD":   return action.payload;
    case "UPSERT": return state.find(s => s.id === action.payload.id)
      ? state.map(s => s.id === action.payload.id ? action.payload : s)
      : [...state, action.payload];
    case "DELETE": return state.filter(s => s.id !== action.id);
    default:       return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function SettingsProvider({ children }) {
  const [settings, dispatch] = useReducer(reducer, []);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    dbFetch().then(data => {
      dispatch({ type:"LOAD", payload: data });
      setLoading(false);
    });
  }, []);

  const saveProvider = useCallback(async (cfg) => {
    const full = { ...cfg, id: cfg.id || genId() };
    dispatch({ type:"UPSERT", payload: full });
    await dbSave(full);
    return full;
  }, []);

  const deleteProvider = useCallback(async (id) => {
    dispatch({ type:"DELETE", id });
    await dbDelete(id);
  }, []);

  const toggleActive = useCallback(async (id) => {
    const s = settings.find(s => s.id === id);
    if (!s) return;
    const updated = { ...s, isActive: !s.isActive };
    dispatch({ type:"UPSERT", payload: updated });
    await dbSave(updated);
  }, [settings]);

  // Get active config for a provider type (used by hooks)
  const getActiveConfig = useCallback((providerId) => {
    return settings.find(s => s.provider === providerId && s.isActive) ?? null;
  }, [settings]);

  return (
    <Ctx.Provider value={{ settings, loading, saveProvider, deleteProvider, toggleActive, getActiveConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
