export const DEFAULT_COUNTRIES = [
  { id: "country-ve", name: "Venezuela", flag: "🇻🇪" },
  { id: "country-co", name: "Colombia", flag: "🇨🇴" },
];

export const COUNTRY_PRESETS = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "DO", name: "Republica Dominicana", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "ES", name: "Espana", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
];

export function buildFlagMap(countries = []) {
  return Object.fromEntries((countries || []).map((country) => [country.name, country.flag]));
}

export function flagFromCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  if (code.length !== 2) return "";

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

export function findCountryPreset(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return COUNTRY_PRESETS.find((country) =>
    country.name.toLowerCase() === normalized || country.code.toLowerCase() === normalized
  ) || null;
}
