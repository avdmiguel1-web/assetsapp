import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { supabase } from "../lib/supabase";
import { encryptToken, decryptToken } from "../lib/crypto";
import { mergeCompanyBranding, mergeCompanyFlags } from "../lib/companyConfig";
import { useAuth } from "./AuthContext";

const Ctx = createContext(null);

function genId(prefix = "PRV") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

async function dbFetchProviders() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("provider_settings")
    .select("*")
    .order("created_at");
  if (error) {
    console.error("[Settings] fetchProviders:", error.message);
    return [];
  }
  return Promise.all((data || []).map(async (row) => ({
    id: row.id,
    provider: row.provider,
    label: row.label,
    token: await decryptToken(row.token),
    baseUrl: row.base_url ?? "",
    extra: row.extra ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
  })));
}

async function dbSaveProvider(cfg) {
  if (!supabase) return cfg;
  const encrypted = await encryptToken(cfg.token);
  const row = {
    id: cfg.id,
    provider: cfg.provider,
    label: cfg.label,
    token: encrypted,
    base_url: cfg.baseUrl || null,
    extra: cfg.extra || {},
    is_active: cfg.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("provider_settings")
    .upsert([row], { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("[Settings] saveProvider:", error.message);
    return cfg;
  }
  return { ...cfg, id: data.id };
}

async function dbDeleteProvider(id) {
  if (!supabase) return;
  await supabase.from("provider_settings").delete().eq("id", id);
}

async function dbFetchDevices() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gps_devices")
    .select("*")
    .order("created_at");
  if (error) {
    if (error.message?.includes("gps_devices")) {
      console.warn("[Settings] gps_devices table missing - run supabase-multitenancy-migration.sql");
      return [];
    }
    console.error("[Settings] fetchDevices:", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    externalId: row.external_id ?? "",
    deviceId: row.device_id,
    name: row.name,
    notes: row.notes ?? "",
    platformPayload: row.platform_payload ?? {},
    createdAt: row.created_at,
  }));
}

async function dbSaveDevice(device) {
  if (!supabase) return device;
  const row = {
    id: device.id,
    provider_id: device.providerId,
    external_id: device.externalId || null,
    device_id: device.deviceId,
    name: device.name,
    notes: device.notes || null,
    platform_payload: device.platformPayload || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("gps_devices")
    .upsert([row], { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("[Settings] saveDevice:", error.message);
    return device;
  }
  return {
    id: data.id,
    providerId: data.provider_id,
    externalId: data.external_id ?? "",
    deviceId: data.device_id,
    name: data.name,
    notes: data.notes ?? "",
    platformPayload: data.platform_payload ?? {},
    createdAt: data.created_at,
  };
}

async function dbDeleteDevice(id) {
  if (!supabase) return;
  await supabase.from("gps_devices").delete().eq("id", id);
}

async function dbFetchBranding(companyId, companyName) {
  if (!supabase || !companyId) return mergeCompanyBranding({}, companyName);
  const { data, error } = await supabase
    .from("company_branding")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    console.error("[Settings] fetchBranding:", error.message);
    return mergeCompanyBranding({}, companyName);
  }
  return mergeCompanyBranding(
    data
      ? {
          appName: data.app_name,
          appSubtitle: data.app_subtitle,
          themeColor: data.theme_color,
          logoOriginal: data.logo_original,
          logoHeader: data.logo_header,
          logoIcon32: data.logo_icon_32,
          logoIcon192: data.logo_icon_192,
          logoIcon512: data.logo_icon_512,
        }
      : {},
    companyName
  );
}

async function dbSaveBranding(companyId, branding) {
  if (!supabase || !companyId) return branding;
  const row = {
    company_id: companyId,
    app_name: branding.appName,
    app_subtitle: branding.appSubtitle || null,
    theme_color: branding.themeColor,
    logo_original: branding.logoOriginal || null,
    logo_header: branding.logoHeader || null,
    logo_icon_32: branding.logoIcon32 || null,
    logo_icon_192: branding.logoIcon192 || null,
    logo_icon_512: branding.logoIcon512 || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("company_branding").upsert([row], { onConflict: "company_id" });
  if (error) {
    console.error("[Settings] saveBranding:", error.message);
  }
  return branding;
}

async function dbFetchFeatureFlags(companyId) {
  if (!supabase || !companyId) return mergeCompanyFlags();
  const { data, error } = await supabase
    .from("company_features")
    .select("flags")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    console.error("[Settings] fetchFeatureFlags:", error.message);
    return mergeCompanyFlags();
  }
  return mergeCompanyFlags(data?.flags || {});
}

async function dbSaveFeatureFlags(companyId, featureFlags) {
  if (!supabase || !companyId) return featureFlags;
  const row = {
    company_id: companyId,
    flags: featureFlags,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("company_features").upsert([row], { onConflict: "company_id" });
  if (error) {
    console.error("[Settings] saveFeatureFlags:", error.message);
  }
  return featureFlags;
}

function listReducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "UPSERT":
      return state.find((item) => item.id === action.payload.id)
        ? state.map((item) => item.id === action.payload.id ? action.payload : item)
        : [...state, action.payload];
    case "DELETE":
      return state.filter((item) => item.id !== action.id);
    default:
      return state;
  }
}

export function SettingsProvider({ children }) {
  const { company, branding: authBranding, featureFlags: authFeatureFlags, refreshProfile } = useAuth();
  const [settings, dispatchProviders] = useReducer(listReducer, []);
  const [devices, dispatchDevices] = useReducer(listReducer, []);
  const [branding, setBranding] = useState(mergeCompanyBranding());
  const [featureFlags, setFeatureFlags] = useState(mergeCompanyFlags());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!company?.id) {
        if (!cancelled) {
          dispatchProviders({ type: "LOAD", payload: [] });
          dispatchDevices({ type: "LOAD", payload: [] });
          setBranding(mergeCompanyBranding());
          setFeatureFlags(mergeCompanyFlags());
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const [providers, gpsDevices, nextBranding, nextFlags] = await Promise.all([
        dbFetchProviders(),
        dbFetchDevices(),
        dbFetchBranding(company.id, company.name),
        dbFetchFeatureFlags(company.id),
      ]);

      if (cancelled) return;
      dispatchProviders({ type: "LOAD", payload: providers });
      dispatchDevices({ type: "LOAD", payload: gpsDevices });
      setBranding(nextBranding);
      setFeatureFlags(nextFlags);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [company?.id, company?.name]);

  useEffect(() => {
    if (authBranding) setBranding(authBranding);
  }, [authBranding]);

  useEffect(() => {
    if (authFeatureFlags) setFeatureFlags(mergeCompanyFlags(authFeatureFlags));
  }, [authFeatureFlags]);

  const saveProvider = useCallback(async (cfg) => {
    const full = { ...cfg, id: cfg.id || genId("PRV") };
    dispatchProviders({ type: "UPSERT", payload: full });
    return dbSaveProvider(full);
  }, []);

  const deleteProvider = useCallback(async (id) => {
    dispatchProviders({ type: "DELETE", id });
    const nextDevices = devices.filter((device) => device.providerId !== id);
    dispatchDevices({ type: "LOAD", payload: nextDevices });
    await Promise.all(devices.filter((device) => device.providerId === id).map((device) => dbDeleteDevice(device.id)));
    await dbDeleteProvider(id);
  }, [devices]);

  const toggleActive = useCallback(async (id) => {
    const current = settings.find((item) => item.id === id);
    if (!current) return;
    const updated = { ...current, isActive: !current.isActive };
    dispatchProviders({ type: "UPSERT", payload: updated });
    await dbSaveProvider(updated);
  }, [settings]);

  const getActiveConfig = useCallback((providerId) => {
    return settings.find((item) => item.provider === providerId && item.isActive) ?? null;
  }, [settings]);

  const saveDevice = useCallback(async (device) => {
    const full = { ...device, id: device.id || genId("DEV") };
    dispatchDevices({ type: "UPSERT", payload: full });
    return dbSaveDevice(full);
  }, []);

  const deleteDevice = useCallback(async (id) => {
    dispatchDevices({ type: "DELETE", id });
    await dbDeleteDevice(id);
  }, []);

  const providerDevices = useCallback((providerId) => devices.filter((device) => device.providerId === providerId), [devices]);

  const getActiveDevice = useCallback((providerType) => {
    const activeProvider = settings.find((item) => item.provider === providerType && item.isActive);
    if (!activeProvider) return null;
    return devices.find((device) => device.providerId === activeProvider.id) ?? null;
  }, [settings, devices]);

  const saveBranding = useCallback(async (nextBranding) => {
    const merged = mergeCompanyBranding(nextBranding, company?.name || "");
    setBranding(merged);
    await dbSaveBranding(company?.id, merged);
    refreshProfile?.();
    return merged;
  }, [company?.id, company?.name, refreshProfile]);

  const saveFeatureFlags = useCallback(async (nextFlags) => {
    const merged = mergeCompanyFlags(nextFlags);
    setFeatureFlags(merged);
    await dbSaveFeatureFlags(company?.id, merged);
    refreshProfile?.();
    return merged;
  }, [company?.id, refreshProfile]);

  const value = useMemo(() => ({
    settings,
    devices,
    branding,
    featureFlags,
    loading,
    saveProvider,
    deleteProvider,
    toggleActive,
    getActiveConfig,
    saveDevice,
    deleteDevice,
    providerDevices,
    getActiveDevice,
    saveBranding,
    saveFeatureFlags,
  }), [
    settings,
    devices,
    branding,
    featureFlags,
    loading,
    saveProvider,
    deleteProvider,
    toggleActive,
    getActiveConfig,
    saveDevice,
    deleteDevice,
    providerDevices,
    getActiveDevice,
    saveBranding,
    saveFeatureFlags,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}
