/**
 * useProviderConfig — syncs active provider token into flespiService at runtime
 * Call this once in App.jsx shell so all hooks/services see the live token.
 */
import { useEffect } from "react";
import { useSettings } from "../stores/SettingsContext";
import { setActiveFlespiConfig } from "../services/flespiService";

export function useProviderConfig() {
  const { getActiveConfig } = useSettings();

  useEffect(() => {
    const cfg = getActiveConfig("flespi");
    if (cfg) {
      setActiveFlespiConfig({ token: cfg.token, baseUrl: cfg.baseUrl || "" });
      console.log("[ProviderConfig] Flespi token loaded from Settings ✅");
    }
  }, [getActiveConfig]);
}
