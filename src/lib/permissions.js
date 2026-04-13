/**
 * permissions.js - Permission system definition
 *
 * Each permission key maps to a specific action in the UI.
 * Admin always has all permissions = true.
 * Users have a customizable subset set by admin.
 */

export const ALL_MODULES = [
  { id: "dashboard", label: "Dashboard", labelEn: "Dashboard", icon: "📊" },
  { id: "locations", label: "Ubicaciones", labelEn: "Locations", icon: "📍" },
  { id: "categories", label: "Categorias", labelEn: "Categories", icon: "🏷️" },
  { id: "activity", label: "Actividad", labelEn: "Activity", icon: "📋" },
  { id: "transfers", label: "Traslados", labelEn: "Transfers", icon: "↔️" },
  { id: "gpshistory", label: "Historial GPS", labelEn: "GPS History", icon: "🗺️" },
  { id: "settings", label: "Configuracion", labelEn: "Settings", icon: "⚙️" },
];

export const ALL_PERMISSIONS = {
  // Module visibility
  module_dashboard: { label: "Ver Dashboard", labelEn: "View Dashboard", group: "modules", default: true },
  module_locations: { label: "Ver Ubicaciones", labelEn: "View Locations", group: "modules", default: true },
  module_categories: { label: "Ver Categorias", labelEn: "View Categories", group: "modules", default: true },
  module_activity: { label: "Ver Actividad", labelEn: "View Activity", group: "modules", default: false },
  module_transfers: { label: "Ver Traslados", labelEn: "View Transfers", group: "modules", default: true },
  module_gpshistory: { label: "Ver Historial GPS", labelEn: "View GPS History", group: "modules", default: true },
  module_settings: { label: "Ver Configuracion", labelEn: "View Settings", group: "modules", default: false },

  // Assets
  asset_create: { label: "Registrar activos", labelEn: "Register assets", group: "assets", default: true },
  asset_edit: { label: "Editar activos", labelEn: "Edit assets", group: "assets", default: true },
  asset_delete: { label: "Eliminar activos", labelEn: "Delete assets", group: "assets", default: false },
  asset_view_detail: { label: "Ver detalle de activo", labelEn: "View asset detail", group: "assets", default: true },

  // Locations
  location_create: { label: "Crear ubicaciones", labelEn: "Create locations", group: "locations", default: true },
  location_edit: { label: "Editar ubicaciones", labelEn: "Edit locations", group: "locations", default: true },
  location_delete: { label: "Eliminar ubicaciones", labelEn: "Delete locations", group: "locations", default: false },

  // Categories
  category_create: { label: "Crear categorias", labelEn: "Create categories", group: "categories", default: true },
  category_edit: { label: "Editar categorias", labelEn: "Edit categories", group: "categories", default: true },
  category_delete: { label: "Eliminar categorias", labelEn: "Delete categories", group: "categories", default: false },

  // Transfers
  transfer_create: { label: "Crear traslados", labelEn: "Create transfers", group: "transfers", default: true },

  // Activity
  activity_view: { label: "Ver actividad", labelEn: "View activity", group: "activity", default: false },

  // GPS
  gps_view: { label: "Ver telemetria GPS", labelEn: "View GPS telemetry", group: "gps", default: true },

  // Settings
  settings_providers: { label: "Gestionar proveedores GPS", labelEn: "Manage GPS providers", group: "settings", default: false },
  settings_users: { label: "Gestionar usuarios", labelEn: "Manage users", group: "settings", default: false },
};

export const PERMISSION_GROUPS = {
  modules: { label: "Modulos visibles", labelEn: "Visible modules" },
  assets: { label: "Activos", labelEn: "Assets" },
  locations: { label: "Ubicaciones", labelEn: "Locations" },
  categories: { label: "Categorias", labelEn: "Categories" },
  activity: { label: "Actividad", labelEn: "Activity" },
  transfers: { label: "Traslados", labelEn: "Transfers" },
  gps: { label: "GPS", labelEn: "GPS" },
  settings: { label: "Configuracion", labelEn: "Settings" },
};

export function defaultPermissions() {
  return Object.fromEntries(Object.entries(ALL_PERMISSIONS).map(([key, value]) => [key, value.default]));
}

export function can(permissions, role, key) {
  if (role === "admin") return true;
  if (!permissions) return ALL_PERMISSIONS[key]?.default ?? false;
  return permissions[key] ?? ALL_PERMISSIONS[key]?.default ?? false;
}
