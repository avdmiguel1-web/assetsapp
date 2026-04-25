/**
 * useTelemetry.js — multi-provider, rate-limited
 * Uses the provider registry to route calls to the correct GPS platform.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_DEVICE_ID, fetchDeviceTelemetry, fetchDeviceMessages } from "../services/flespiService";
import { getProvider } from "../services/providers/registry";
import { useSettings } from "../stores/SettingsContext";

// Global in-flight guard
const inFlight = new Set();

/**
 * useTelemetry(deviceId, pollInterval, gpsProvider)
 * gpsProvider defaults to "flespi"
 */
export function useTelemetry(deviceId = DEFAULT_DEVICE_ID, pollInterval = 30000, gpsProvider = "flespi") {
  const { getActiveConfig } = useSettings();
  const [telemetry,   setTelemetry]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mounted  = useRef(true);
  const retryRef = useRef(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (retryRef.current) clearTimeout(retryRef.current); }; }, []);

  const doFetch = useCallback(async (isFirst = false) => {
    if (!deviceId) {
      if (mounted.current) {
        setTelemetry(null);
        setError(null);
        setLoading(false);
      }
      return;
    }
    const key = `telemetry:${gpsProvider}:${deviceId}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    if (isFirst && mounted.current) setLoading(true);
    try {
      let data;
      const provider = getProvider(gpsProvider);
      const cfg      = getActiveConfig(gpsProvider);
      if (provider && cfg) {
        data = await provider.fetchTelemetry(deviceId, cfg);
      } else {
        // Fallback to flespi service (uses .env token)
        data = await fetchDeviceTelemetry(deviceId);
      }
      if (mounted.current) { setTelemetry(data); setError(null); setLastUpdated(new Date()); }
    } catch (err) {
      const is429 = err.message?.includes("429");
      if (mounted.current) {
        setError(is429 ? "Límite de solicitudes — reintentando en 60s" : err.message);
        if (is429) { retryRef.current = setTimeout(() => { if (mounted.current) setError(null); }, 60000); }
      }
    } finally {
      inFlight.delete(key);
      if (isFirst && mounted.current) setLoading(false);
    }
  }, [deviceId, gpsProvider, getActiveConfig]);

  useEffect(() => {
    const t = setTimeout(() => doFetch(true), 300);
    const id = setInterval(() => { if (!error?.includes("429")) doFetch(false); }, pollInterval);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [doFetch, pollInterval, error]);

  return { telemetry, loading, error, lastUpdated, refresh: () => doFetch(true) };
}

/**
 * useMessages(deviceId, gpsProvider)
 */
export function useMessages(deviceId = null, gpsProvider = "flespi") {
  const { getActiveConfig } = useSettings();
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const mounted  = useRef(true);
  const lastLoad = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    if (!deviceId) { setMessages([]); setLoading(false); setError(null); return; }
    const now = Date.now();
    if (now - lastLoad.current < 10000) return;
    const key = `messages:${gpsProvider}:${deviceId}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      let data;
      const provider = getProvider(gpsProvider);
      const cfg      = getActiveConfig(gpsProvider);
      if (provider && cfg) {
        data = await provider.fetchMessages(deviceId, 300, cfg);
      } else {
        data = await fetchDeviceMessages(deviceId, 300);
      }
      if (mounted.current) { setMessages(data); lastLoad.current = Date.now(); }
    } catch (err) {
      const is429 = err.message?.includes("429");
      if (mounted.current) setError(is429 ? "Límite de solicitudes de Flespi. Espera unos segundos y presiona Actualizar." : err.message);
    } finally {
      inFlight.delete(key);
      if (mounted.current) setLoading(false);
    }
  }, [deviceId, gpsProvider, getActiveConfig]);

  useEffect(() => {
    setMessages([]); setError(null);
    if (!deviceId) return;
    const t = setTimeout(() => load(), 500);
    return () => clearTimeout(t);
  }, [deviceId, gpsProvider]);

  // Derive ignition events
  const ignitionEvents = [];
  let lastIgn = undefined;
  for (const msg of messages) {
    const ign = msg.ignition;
    if (ign !== undefined && ign !== null && ign !== lastIgn) {
      ignitionEvents.push({ timestamp:msg.timestamp, status:ign, lat:msg.latitude, lng:msg.longitude });
      lastIgn = ign;
    }
  }

  return { messages, loading, error, ignitionEvents, reload: load };
}
