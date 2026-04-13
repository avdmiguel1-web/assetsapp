/**
 * FleetCore — Test de conexión real Flespi
 * Ejecuta: node test-flespi.mjs
 *
 * Este script llama DIRECTAMENTE a la API de Flespi desde Node.js
 * (sin CORS, sin proxy) y muestra exactamente qué devuelve cada endpoint.
 */

const TOKEN     = "OWuoCjZ6RDjJAr1cwbAg78Fw7O4cX4WRVehf5QvVput3ZdzaxqXqgTN6z5fTUCqd";
const DEVICE_ID = 7813187;
const BASE      = "https://flespi.io";
const H         = { Authorization: `FlespiToken ${TOKEN}`, Accept: "application/json" };

const sep = (t) => { console.log("\n" + "═".repeat(60)); console.log("  " + t); console.log("═".repeat(60)); };
const ok  = (s) => console.log(`\x1b[32m  ✅ ${s}\x1b[0m`);
const err = (s) => console.log(`\x1b[31m  ❌ ${s}\x1b[0m`);
const inf = (s) => console.log(`\x1b[36m  ℹ  ${s}\x1b[0m`);

async function call(url) {
  const res = await fetch(url, { headers: H });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, ok: res.ok, body };
}

// ── 1. Device info ────────────────────────────────────────────────────────────
sep("TEST 1: GET /gw/devices/" + DEVICE_ID);
{
  const r = await call(`${BASE}/gw/devices/${DEVICE_ID}`);
  if (r.ok) {
    const d = r.body?.result?.[0] ?? {};
    ok(`HTTP ${r.status} — Dispositivo encontrado`);
    inf(`Name: ${d.name}  |  ID: ${d.id}  |  Type ID: ${d.device_type_id}`);
    inf(`Config: ${JSON.stringify(d.configuration ?? {})}`);
  } else {
    err(`HTTP ${r.status} — ${r.body?.errors?.[0]?.reason ?? r.body?.reason ?? "Error desconocido"}`);
    err("⚠ El token puede no tener acceso a este dispositivo");
  }
}

// ── 2. Telemetry endpoint ─────────────────────────────────────────────────────
sep("TEST 2: GET /gw/devices/" + DEVICE_ID + "/telemetry");
{
  const r = await call(`${BASE}/gw/devices/${DEVICE_ID}/telemetry`);
  if (r.ok) {
    const raw = r.body?.result?.[0] ?? {};
    const keys = Object.keys(raw);
    ok(`HTTP ${r.status} — ${keys.length} parámetros de telemetría`);
    if (keys.length === 0) {
      err("⚠ Resultado vacío — el dispositivo no ha enviado datos aún");
    } else {
      inf("Parámetros recibidos:");
      for (const [k, val] of Object.entries(raw)) {
        const v = typeof val === "object" && "value" in val ? val.value : val;
        console.log(`     ${k.padEnd(35)} = ${v}`);
      }
    }
  } else {
    err(`HTTP ${r.status} — ${r.body?.errors?.[0]?.reason ?? r.body?.reason ?? "Error"}`);
    if (r.status === 404) err("⚠ /telemetry no disponible → se usará /messages como fallback");
  }
}

// ── 3. Latest message ─────────────────────────────────────────────────────────
sep("TEST 3: GET /gw/devices/" + DEVICE_ID + "/messages?count=1&reverse=true");
{
  const r = await call(`${BASE}/gw/devices/${DEVICE_ID}/messages?count=1&reverse=true`);
  if (r.ok) {
    const msgs = r.body?.result ?? [];
    if (msgs.length === 0) {
      err("No hay mensajes en el historial");
    } else {
      const m = msgs[0];
      ok(`HTTP ${r.status} — Último mensaje recibido:`);
      for (const [k, v] of Object.entries(m)) {
        console.log(`     ${k.padEnd(35)} = ${v}`);
      }
    }
  } else {
    err(`HTTP ${r.status} — ${r.body?.errors?.[0]?.reason ?? "Error"}`);
  }
}

// ── 4. Message count ──────────────────────────────────────────────────────────
sep("TEST 4: GET /gw/devices/" + DEVICE_ID + "/messages (total count)");
{
  const r = await call(`${BASE}/gw/devices/${DEVICE_ID}/messages?count=1`);
  if (r.ok) {
    const total = r.body?.["all-count"] ?? r.body?.result?.length ?? "?";
    ok(`HTTP ${r.status} — Total mensajes disponibles: ${total}`);
  } else {
    err(`HTTP ${r.status}`);
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
sep("RESUMEN — Copia y pega el output completo si hay errores");
inf("Token: " + TOKEN.slice(0, 20) + "...");
inf("Device ID: " + DEVICE_ID);
inf("Timestamp: " + new Date().toLocaleString("es-VE"));
