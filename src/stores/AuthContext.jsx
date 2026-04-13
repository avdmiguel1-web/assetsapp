/**
 * AuthContext — Supabase Auth + user profile + permissions
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { can, defaultPermissions } from "../lib/permissions";

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

export function AuthProvider({ children }) {
  const [session,     setSession]     = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [authError,   setAuthError]   = useState(null);

  const loadUserData = useCallback(async (userId) => {
    const [prof, perms] = await Promise.all([
      fetchProfile(userId),
      fetchPermissions(userId),
    ]);
    setProfile(prof);
    setPermissions(perms);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else { setProfile(null); setPermissions(null); }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  // ── Auth actions ──
  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); return false; }
    return true;
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    setAuthError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName?.trim() || normalizedEmail.split("@")[0];
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
          body: JSON.stringify({ email: normalizedEmail, password, fullName: normalizedName }),
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
      options: { data: { full_name: normalizedName } }
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
    setProfile(null); setPermissions(null); setSession(null);
  }, []);

  const clearError = () => setAuthError(null);

  // ── Permission helper ──
  const canDo = useCallback((key) => {
    return can(permissions, profile?.role, key);
  }, [permissions, profile]);

  const isAdmin = profile?.role === "admin";

  return (
    <AuthCtx.Provider value={{
      session, profile, permissions, loading, authError,
      isAdmin, isActive: profile?.is_active ?? true,
      signIn, signUp, signOut, clearError, canDo,
      refreshProfile: () => session && loadUserData(session.user.id),
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
