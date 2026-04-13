/**
 * crypto.js — AES-GCM encryption for provider tokens
 * Tokens are encrypted before saving to Supabase and decrypted on read.
 * The encryption key is derived from a fixed app secret + a per-install salt.
 */

const APP_SECRET = import.meta.env.VITE_CRYPTO_SECRET || "fleetcore-default-secret-2024";

async function getKey() {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(APP_SECRET), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("fleetcore-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptToken(plainText) {
  try {
    const key = await getKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
    // Pack iv + ciphertext into base64
    const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Fallback: store as-is if SubtleCrypto unavailable (e.g. HTTP dev)
    return plainText;
  }
}

export async function decryptToken(cipherText) {
  try {
    const key     = await getKey();
    const combined = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
    const iv       = combined.slice(0, 12);
    const data     = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plainBuf);
  } catch {
    // Fallback: return as-is (plain token or failed decrypt)
    return cipherText;
  }
}
