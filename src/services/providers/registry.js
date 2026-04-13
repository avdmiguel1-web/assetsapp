/**
 * Provider Registry — Factory Pattern
 * ─────────────────────────────────────
 * To add a new GPS provider:
 *   1. Create src/services/providers/myProvider.js implementing the IProvider interface
 *   2. Register it here in PROVIDER_REGISTRY
 * Nothing else in the app needs to change.
 *
 * IProvider interface:
 *   { id, label, logoEmoji, fields[], testConnection(cfg), fetchTelemetry(deviceId, cfg), fetchMessages(deviceId, limit, cfg) }
 */

import flespiProvider  from "./flespi.js";
import wialOnProvider  from "./wialon.js";
import traccarProvider from "./traccar.js";

export const PROVIDER_REGISTRY = {
  flespi:  flespiProvider,
  wialon:  wialOnProvider,
  traccar: traccarProvider,
};

export function getProvider(id) {
  return PROVIDER_REGISTRY[id] ?? null;
}

export function listProviders() {
  return Object.values(PROVIDER_REGISTRY);
}
