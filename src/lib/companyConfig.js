export const DEFAULT_COMPANY_FLAGS = {
  "module.activity": true,
  "module.gpshistory": true,
  "system.branding": true,
  "system.featureFlags": true,
  "gps.deviceProvisioning": true,
  "gps.provider.flespi": true,
  "gps.provider.wialon": true,
  "gps.provider.traccar": true,
};

export const DEFAULT_COMPANY_BRANDING = {
  appName: "Gestion de Activos",
  appSubtitle: "Asset Management System",
  themeColor: "#0f1f38",
  logoOriginal: "",
  logoHeader: "",
  logoIcon32: "",
  logoIcon192: "",
  logoIcon512: "",
};

export function mergeCompanyFlags(flags = {}) {
  return { ...DEFAULT_COMPANY_FLAGS, ...(flags || {}) };
}

export function isCompanyFeatureEnabled(flags = {}, key, fallback = false) {
  const merged = mergeCompanyFlags(flags);
  if (key in merged) return !!merged[key];
  return fallback;
}

export function mergeCompanyBranding(branding = {}, companyName = "") {
  return {
    ...DEFAULT_COMPANY_BRANDING,
    ...(branding || {}),
    appName: branding?.appName?.trim() || companyName || DEFAULT_COMPANY_BRANDING.appName,
    themeColor: branding?.themeColor?.trim() || DEFAULT_COMPANY_BRANDING.themeColor,
  };
}
