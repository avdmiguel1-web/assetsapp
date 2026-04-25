import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";
import { mergeCompanyBranding, mergeCompanyFlags, isCompanyFeatureEnabled } from "../lib/companyConfig";
import { setActiveTenantScope } from "../lib/tenantScope";

const AuthCtx = createContext(null);

async function fetchProfile(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

async function fetchPermissions(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("user_permissions")
    .select("permissions")
    .eq("user_id", userId)
    .single();
  return data?.permissions ?? null;
}

async function fetchCompany(companyId) {
  if (!supabase || !companyId) return null;
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

async function fetchBranding(companyId) {
  if (!supabase || !companyId) return null;
  const { data } = await supabase
    .from("company_branding")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

async function fetchCompanyFeatures(companyId) {
  if (!supabase || !companyId) return null;
  const { data } = await supabase
    .from("company_features")
    .select("flags")
    .eq("company_id", companyId)
    .maybeSingle();
  return data?.flags ?? null;
}

function normalizeBranding(rawBranding, companyName) {
  return mergeCompanyBranding(
    rawBranding
      ? {
          appName: rawBranding.app_name,
          appSubtitle: rawBranding.app_subtitle,
          themeColor: rawBranding.theme_color,
          logoOriginal: rawBranding.logo_original,
          logoHeader: rawBranding.logo_header,
          logoIcon32: rawBranding.logo_icon_32,
          logoIcon192: rawBranding.logo_icon_192,
          logoIcon512: rawBranding.logo_icon_512,
        }
      : {},
    companyName
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [branding, setBranding] = useState(mergeCompanyBranding());
  const [featureFlags, setFeatureFlags] = useState(mergeCompanyFlags());
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearTenantState = useCallback(() => {
    setProfile(null);
    setCompany(null);
    setBranding(mergeCompanyBranding());
    setFeatureFlags(mergeCompanyFlags());
    setPermissions(null);
    setActiveTenantScope({});
  }, []);

  const loadUserData = useCallback(async (userId) => {
    const nextProfile = await fetchProfile(userId);
    if (!nextProfile) {
      clearTenantState();
      return null;
    }

    const [nextPermissions, nextCompany, nextBranding, nextFeatureFlags] = await Promise.all([
      fetchPermissions(userId),
      fetchCompany(nextProfile.company_id),
      fetchBranding(nextProfile.company_id),
      fetchCompanyFeatures(nextProfile.company_id),
    ]);

    setProfile(nextProfile);
    setPermissions(nextPermissions);
    setCompany(nextCompany);
    setBranding(normalizeBranding(nextBranding, nextCompany?.name || nextProfile?.company_name || ""));
    setFeatureFlags(mergeCompanyFlags(nextFeatureFlags || {}));
    setActiveTenantScope({
      companyId: nextProfile.company_id,
      companySlug: nextCompany?.slug || "",
    });

    return {
      profile: nextProfile,
      company: nextCompany,
      permissions: nextPermissions,
    };
  }, [clearTenantState]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: nextSession } }) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) await loadUserData(nextSession.user.id);
      else clearTenantState();
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) await loadUserData(nextSession.user.id);
      else clearTenantState();
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, clearTenantState]);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email, password, fullName, companyName) => {
    setAuthError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName?.trim() || normalizedEmail.split("@")[0];
    const normalizedCompanyName = companyName?.trim() || normalizedEmail.split("@")[1] || "Empresa";
    const isLocalDev =
      typeof window !== "undefined" &&
      /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let functionResponse = { data: null, error: null };
    if (supabaseUrl && anonKey) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            fullName: normalizedName,
            companyName: normalizedCompanyName,
          }),
        });

        const rawText = await response.text();
        let payload = null;
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch {
          payload = rawText ? { error: rawText } : null;
        }

        functionResponse = response.ok
          ? { data: payload, error: null }
          : { data: payload, error: { message: payload?.error || `HTTP ${response.status}` } };
      } catch (error) {
        functionResponse = {
          data: null,
          error: { message: error instanceof Error ? error.message : "No se pudo contactar create-user." },
        };
      }
    }

    if (!functionResponse.error && !functionResponse.data?.error) {
      const login = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (login.error) {
        setAuthError(login.error.message);
        return false;
      }
      return true;
    }

    const functionMessage = functionResponse.error?.message || functionResponse.data?.error || "";
    const functionMissing =
      /Failed to send a request to the Edge Function/i.test(functionMessage) ||
      /Could not find the function/i.test(functionMessage) ||
      /Failed to fetch/i.test(functionMessage) ||
      /NetworkError/i.test(functionMessage) ||
      /Load failed/i.test(functionMessage) ||
      /Network request failed/i.test(functionMessage) ||
      /create-user/i.test(functionMessage);

    if (/401|unauthorized|jwt/i.test(functionMessage)) {
      setAuthError("No se pudo crear el usuario porque la funcion 'create-user' sigue protegida por JWT o no esta usando la configuracion publica correcta. Vuelve a desplegar la funcion con `verify_jwt = false` y redepliega la app en Vercel.");
      return false;
    }

    if (!functionMissing) {
      setAuthError(functionMessage);
      return false;
    }

    if (!isLocalDev) {
      setAuthError("No se pudo crear el usuario porque la funcion 'create-user' no esta desplegada o no responde en Supabase. Despliegala para registrar usuarios sin depender del envio de correos.");
      return false;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedName,
          company_name: normalizedCompanyName,
        },
      },
    });

    if (error) {
      if (/email rate limit exceeded/i.test(error.message || "")) {
        setAuthError("No se pudo crear el usuario porque Supabase alcanzo el limite de correos. Despliega la funcion 'create-user' para registrar usuarios sin depender del email de confirmacion.");
        return false;
      }
      setAuthError(error.message);
      return false;
    }

    if (data.session) return true;
    return "confirm";
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearTenantState();
    setSession(null);
  }, [clearTenantState]);

  const clearError = useCallback(() => setAuthError(null), []);

  const canDo = useCallback((key) => can(permissions, profile?.role, key), [permissions, profile]);
  const isFeatureEnabled = useCallback(
    (key, fallback = false) => isCompanyFeatureEnabled(featureFlags, key, fallback),
    [featureFlags]
  );

  const contextValue = useMemo(() => ({
    session,
    profile,
    company,
    branding,
    featureFlags,
    permissions,
    loading,
    authError,
    isAdmin: profile?.role === "admin",
    isActive: profile?.is_active ?? true,
    signIn,
    signUp,
    signOut,
    clearError,
    canDo,
    isFeatureEnabled,
    refreshProfile: () => session && loadUserData(session.user.id),
  }), [
    session,
    profile,
    company,
    branding,
    featureFlags,
    permissions,
    loading,
    authError,
    signIn,
    signUp,
    signOut,
    clearError,
    canDo,
    isFeatureEnabled,
    loadUserData,
  ]);

  return <AuthCtx.Provider value={contextValue}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
