/**
 * flespiService.js — provider-agnostic adapter for Flespi
 * Token is injected at runtime via setActiveFlespiConfig()
 * called from useProviderConfig hook on app startup.
 */
import flespiProvider from "./providers/flespi.js";

export const DEFAULT_DEVICE_ID = import.meta.env.VITE_FLESPI_DEVICE_ID || "7813187";

// Runtime config — overridden by SettingsContext on load
let _cfg = {
  token:   import.meta.env.VITE_FLESPI_TOKEN ||
           "OWuoCjZ6RDjJAr1cwbAg78Fw7O4cX4WRVehf5QvVput3ZdzaxqXqgTN6z5fTUCqd",
  baseUrl: "",
};

export function setActiveFlespiConfig(cfg) { _cfg = { ..._cfg, ...cfg }; }
export function getActiveFlespiConfig()    { return _cfg; }

export async function fetchDeviceTelemetry(deviceId = DEFAULT_DEVICE_ID) {
  return flespiProvider.fetchTelemetry(deviceId, _cfg);
}

export async function fetchDeviceMessages(deviceId = DEFAULT_DEVICE_ID, limit = 500) {
  return flespiProvider.fetchMessages(deviceId, limit, _cfg);
}

export function parseMessage(msg) {
  if (!msg) return { isEmpty: true };
  return {
    isEmpty: false,
    timestamp:      msg.timestamp,
    ignitionOn:     msg["engine.ignition.status"] === true || msg["engine.ignition.status"] === 1,
    ignition:       msg["engine.ignition.status"] ?? null,
    speed:          msg["position.speed"]         ?? null,
    latitude:       msg["position.latitude"]      ?? null,
    longitude:      msg["position.longitude"]     ?? null,
    satellites:     msg["position.satellites"]    ?? null,
    direction:      msg["position.direction"]     ?? null,
    posValid:       msg["position.valid"]         ?? false,
    hasPosition:    msg["position.latitude"] != null && msg["position.longitude"] != null,
    batteryVoltage: msg["battery.voltage"]        ?? null,
    batteryLevel:   msg["battery.level"]          ?? null,
    gsmSignalDbm:   msg["gsm.signal.dbm"]         ?? null,

    // ── Combustible ─────────────────────────────────────────────────────────
    // Estado actual: sin hardware instalado → todos los campos retornan null.
    // TODO: Activar cuando se instalen equipos Teltonika FMC150.
    //
    // Parámetros Flespi según codec AVL FMC150:
    //   "can.fuel.level"    (AVL ID  50) → % nivel de combustible vía CAN bus  [PREFERIDO]
    //   "fuel.level.liter"  (AVL ID  48) → litros vía sensor OBD/CAN
    //   "can.fuel.used.gps" (AVL ID 223) → consumo acumulado GPS (litros)
    //
    // Lógica de prioridad para mostrar en UI:
    //   fuelLevelPercent → fuelLevelLiters → null  (mostrar "N/A" si ambos son null)
    fuelLevelPercent: msg["can.fuel.level"]    ?? null,  // % (0-100)
    fuelLevelLiters:  msg["fuel.level.liter"]  ?? null,  // litros
    fuelUsedGps:      msg["can.fuel.used.gps"] ?? null,  // litros acumulados
    // ────────────────────────────────────────────────────────────────────────
  };
}
