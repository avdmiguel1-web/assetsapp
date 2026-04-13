/**
 * SettingsContext — manages GPS provider configurations + GPS devices
 * Persists to Supabase tables:
 *   - `provider_settings`  (platforms: flespi, traccar, wialon…)
 *   - `gps_devices`        (individual devices linked to a provider)
 * Tokens are AES-encrypted before storage.
 */
import { createContext, useContext, useReducer, useEffect, useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { encryptToken, decryptToken } from "../lib/crypto";

const Ctx = createContext(null);

function genId(prefix = "PRV") {
  return `${prefix}-` + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ── PROVIDER Supabase helpers ─────────────────────────────────────────────────

async function dbFetchProviders() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("provider_settings").select("*").order("created_at");
  if (error) { console.error("[Settings] fetchProviders:", error.message); return []; }
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

async function dbSaveProvider(cfg) {
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
  const { data, error } = await supabase
    .from("provider_settings")
    .upsert([row], { onConflict: "id" })
    .select()
    .single();
  if (error) { console.error("[Settings] saveProvider:", error.message); return cfg; }
  return { ...cfg, id: data.id };
}

async function dbDeleteProvider(id) {
  if (!supabase) return;
  await supabase.from("provider_settings").delete().eq("id", id);
}

// ── GPS DEVICE Supabase helpers ───────────────────────────────────────────────

async function dbFetchDevices() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gps_devices")
    .select("*")
    .order("created_at");
  if (error) {
    // Graceful fallback if table doesn't exist yet
    if (error.message?.includes("gps_devices")) {
      console.warn("[Settings] gps_devices table missing — run supabase-gps-devices-migration.sql");
      return [];
    }
    console.error("[Settings] fetchDevices:", error.message);
    return [];
  }
  return data.map(r => ({
    id:         r.id,
    providerId: r.provider_id,
    deviceId:   r.device_id,
    name:       r.name,
    notes:      r.notes ?? "",
    createdAt:  r.created_at,
  }));
}

async function dbSaveDevice(device) {
  if (!supabase) return device;
  const row = {
    id:          device.id,
    provider_id: device.providerId,
    device_id:   device.deviceId,
    name:        device.name,
    notes:       device.notes || null,
    updated_at:  new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("gps_devices")
    .upsert([row], { onConflict: "id" })
    .select()
    .single();
  if (error) {
    if (error.message?.includes("gps_devices")) {
      console.warn("[Settings] gps_devices table missing; device entry skipped");
      return device;
    }
    console.error("[Settings] saveDevice:", error.message);
    return device;
  }
  return {
    id:         data.id,
    providerId: data.provider_id,
    deviceId:   data.device_id,
    name:       data.name,
    notes:      data.notes ?? "",
    createdAt:  data.created_at,
  };
}

async function dbDeleteDevice(id) {
  if (!supabase) return;
  await supabase.from("gps_devices").delete().eq("id", id);
}

// ── Reducers ──────────────────────────────────────────────────────────────────

function providerReducer(state, action) {
  switch (action.type) {
    case "LOAD":   return action.payload;
    case "UPSERT": return state.find(s => s.id === action.payload.id)
      ? state.map(s => s.id === action.payload.id ? action.payload : s)
      : [...state, action.payload];
    case "DELETE": return state.filter(s => s.id !== action.id);
    default:       return state;
  }
}

function deviceReducer(state, action) {
  switch (action.type) {
    case "LOAD":   return action.payload;
    case "UPSERT": return state.find(d => d.id === action.payload.id)
      ? state.map(d => d.id === action.payload.id ? action.payload : d)
      : [...state, action.payload];
    case "DELETE": return state.filter(d => d.id !== action.id);
    default:       return state;
  }
}

// ── Context Provider ──────────────────────────────────────────────────────────

export function SettingsProvider({ children }) {
  const [settings, dispatchProv]  = useReducer(providerReducer, []);
  const [devices,  dispatchDev]   = useReducer(deviceReducer,   []);
  const [loading,  setLoading]    = useState(true);

  // Initial load
  useEffect(() => {
    Promise.all([dbFetchProviders(), dbFetchDevices()]).then(([provs, devs]) => {
      dispatchProv({ type: "LOAD", payload: provs });
      dispatchDev({ type: "LOAD", payload: devs });
      setLoading(false);
    });
  }, []);

  // ── Provider actions ────────────────────────────────────────────────────────

  const saveProvider = useCallback(async (cfg) => {
    const full = { ...cfg, id: cfg.id || genId("PRV") };
    dispatchProv({ type: "UPSERT", payload: full });
    await dbSaveProvider(full);
    return full;
  }, []);

  const deleteProvider = useCallback(async (id) => {
    dispatchProv({ type: "DELETE", id });
    // Also delete linked devices
    const linked = devices.filter(d => d.providerId === id);
    await Promise.all(linked.map(d => dbDeleteDevice(d.id)));
    dispatchDev({ type: "LOAD", payload: devices.filter(d => d.providerId !== id) });
    await dbDeleteProvider(id);
  }, [devices]);

  const toggleActive = useCallback(async (id) => {
    const s = settings.find(s => s.id === id);
    if (!s) return;
    const updated = { ...s, isActive: !s.isActive };
    dispatchProv({ type: "UPSERT", payload: updated });
    await dbSaveProvider(updated);
  }, [settings]);

  const getActiveConfig = useCallback((providerId) => {
    return settings.find(s => s.provider === providerId && s.isActive) ?? null;
  }, [settings]);

  // ── Device actions ──────────────────────────────────────────────────────────

  const saveDevice = useCallback(async (device) => {
    const full = { ...device, id: device.id || genId("DEV") };
    dispatchDev({ type: "UPSERT", payload: full });
    await dbSaveDevice(full);
    return full;
  }, []);

  const deleteDevice = useCallback(async (id) => {
    dispatchDev({ type: "DELETE", id });
    await dbDeleteDevice(id);
  }, []);

  /** Returns all devices for a given provider record id */
  const providerDevices = useCallback((providerId) => {
    return devices.filter(d => d.providerId === providerId);
  }, [devices]);

  /** Returns the first device for the active provider of a given type */
  const getActiveDevice = useCallback((providerType) => {
    const active = settings.find(s => s.provider === providerType && s.isActive);
    if (!active) return null;
    return devices.find(d => d.providerId === active.id) ?? null;
  }, [settings, devices]);

  return (
    <Ctx.Provider value={{
      // provider
      settings,
      loading,
      saveProvider,
      deleteProvider,
      toggleActive,
      getActiveConfig,
      // devices
      devices,
      saveDevice,
      deleteDevice,
      providerDevices,
      getActiveDevice,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
