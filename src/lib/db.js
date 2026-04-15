/**
 * Database helpers — all CRUD for assets, locations, transfers.
 * Falls back gracefully to in-memory if Supabase is not configured.
 */
import { supabase } from "./supabase";
import { extractOriginalRemoteUrl, inferRemoteTypeFromValue, normalizeRemoteFileList, toDisplayableRemoteUrl } from "./remoteFiles";

function getErrorMessage(op, error) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" | ") || `Error desconocido en ${op}`;
}

function throwDbError(op, error) {
  const message = getErrorMessage(op, error);
  console.error(`[DB] ${op}:`, message);
  throw new Error(message);
}

function getMissingPublicTable(error) {
  const match = error?.message?.match(/Could not find the table 'public\.([^']+)' in the schema cache/i);
  return match?.[1] ?? null;
}

function isMissingPublicTable(error, table) {
  return getMissingPublicTable(error) === table;
}

function throwFriendlySchemaError(op, error) {
  const missingTable = getMissingPublicTable(error);

  if (missingTable === "categories") {
    throw new Error(
      "La tabla 'categories' no existe en Supabase todavia. Ejecuta la migracion `supabase-categories-migration.sql` en el SQL Editor y vuelve a intentar."
    );
  }

  if (missingTable === "countries") {
    throw new Error(
      "La tabla 'countries' no existe en Supabase todavia. Ejecuta la migracion `supabase-countries-migration.sql` en el SQL Editor y vuelve a intentar."
    );
  }

  throwDbError(op, error);
}

function getMissingAssetColumn(error) {
  const match = error?.message?.match(/Could not find the '([^']+)' column of 'assets' in the schema cache/i);
  return match?.[1] ?? null;
}

function getMissingColumn(error, table) {
  const match = error?.message?.match(new RegExp(`Could not find the '([^']+)' column of '${table}' in the schema cache`, "i"));
  return match?.[1] ?? null;
}

function omitOptionalColumn(row, error, table, optionalColumns = []) {
  const missingColumn = table === "assets" ? getMissingAssetColumn(error) : getMissingColumn(error, table);
  const allowedColumns = new Set(optionalColumns);

  if (!missingColumn || !allowedColumns.has(missingColumn) || !(missingColumn in row)) {
    return null;
  }

  const nextRow = { ...row };
  delete nextRow[missingColumn];
  console.warn(`[DB] ${table} fallback: retrying without optional column "${missingColumn}"`);
  return nextRow;
}

async function runWithOptionalColumnFallback(op, table, row, optionalColumns, executor) {
  let currentRow = row;

  while (true) {
    const result = await executor(currentRow);
    if (!result.error) return result;

    const fallbackRow = omitOptionalColumn(currentRow, result.error, table, optionalColumns);
    if (!fallbackRow) throwDbError(op, result.error);
    currentRow = fallbackRow;
  }
}

// ── ASSETS ──────────────────────────────────────────────────────────────────

export async function dbFetchAssets() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("[DB] fetchAssets:", error.message); return []; }
  return data.map(dbToAsset);
}

export async function dbInsertAsset(asset) {
  if (!supabase) return asset;
  const row = assetToDb(asset, true);
  const { data } = await runWithOptionalColumnFallback(
    "insertAsset",
    "assets",
    row,
    ["gps_provider", "rental_start_date", "rental_end_date", "rental_start_time", "rental_end_time"],
    (currentRow) => supabase.from("assets").insert([currentRow]).select().single()
  );
  return dbToAsset(data);
}

export async function dbUpdateAsset(asset) {
  if (!supabase) return asset;
  const row = assetToDb(asset);
  const { data } = await runWithOptionalColumnFallback(
    "updateAsset",
    "assets",
    row,
    ["gps_provider", "rental_start_date", "rental_end_date", "rental_start_time", "rental_end_time"],
    (currentRow) => supabase.from("assets").update(currentRow).eq("id", asset.id).select().single()
  );
  return dbToAsset(data);
}

export async function dbDeleteAsset(id) {
  if (!supabase) return;
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throwDbError("deleteAsset", error);
}

// ── LOCATIONS ────────────────────────────────────────────────────────────────

export async function dbFetchLocations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("[DB] fetchLocations:", error.message); return []; }
  return data.map(dbToLocation);
}

export async function dbInsertLocation(loc) {
  if (!supabase) return loc;
  const row = locationToDb(loc);
  const { data } = await runWithOptionalColumnFallback(
    "insertLocation",
    "locations",
    row,
    ["rental_start_date", "rental_end_date"],
    (currentRow) => supabase.from("locations").insert([currentRow]).select().single()
  );
  return dbToLocation(data);
}

export async function dbUpdateLocation(loc) {
  if (!supabase) return loc;
  const row = locationToDb(loc);
  const { data } = await runWithOptionalColumnFallback(
    "updateLocation",
    "locations",
    row,
    ["rental_start_date", "rental_end_date"],
    (currentRow) => supabase.from("locations").update(currentRow).eq("id", loc.id).select().single()
  );
  return dbToLocation(data);
}

export async function dbDeleteLocation(id) {
  if (!supabase) return;
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) throwDbError("deleteLocation", error);
}

// COUNTRIES
export async function dbFetchCountries() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .order("name");
  if (error) {
    if (isMissingPublicTable(error, "countries")) {
      console.warn("[DB] fetchCountries: countries table missing in Supabase");
      return [];
    }
    console.error("[DB] fetchCountries:", error.message);
    return [];
  }
  return data.map(dbToCountry);
}

export async function dbInsertCountry(country) {
  if (!supabase) return country;
  const { data, error } = await supabase
    .from("countries")
    .insert([countryToDb(country)])
    .select()
    .single();
  if (error) throwFriendlySchemaError("insertCountry", error);
  return dbToCountry(data);
}

export async function dbUpdateCountry(country) {
  if (!supabase) return country;
  const { data, error } = await supabase
    .from("countries")
    .update(countryToDb(country))
    .eq("id", country.id)
    .select()
    .single();
  if (error) throwFriendlySchemaError("updateCountry", error);
  return dbToCountry(data);
}

export async function dbDeleteCountry(id) {
  if (!supabase) return;
  const { error } = await supabase.from("countries").delete().eq("id", id);
  if (error) throwFriendlySchemaError("deleteCountry", error);
}

// ── TRANSFERS ────────────────────────────────────────────────────────────────

export async function dbFetchTransfers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .order("ts", { ascending: false });
  if (error) { console.error("[DB] fetchTransfers:", error.message); return []; }
  return data.map(dbToTransfer);
}

function dbToTransfer(r) {
  return {
    id:              r.id,
    assetId:         r.asset_id,
    fromLocation:    r.from_location,
    fromCountry:     r.from_country,
    fromAddress:     r.from_address,
    toLocation:      r.to_location,
    toCountry:       r.to_country,
    toAddress:       r.to_address,
    rentalStartDate: r.rental_start_date,
    rentalEndDate:   r.rental_end_date,
    rentalStartTime: r.rental_start_time,
    rentalEndTime:   r.rental_end_time,
    ts:              r.ts,
  };
}

export async function dbInsertTransfer(transfer) {
  if (!supabase) return transfer;
  // Convert camelCase payload to snake_case for DB
  const row = {
    id:            transfer.id,
    asset_id:          transfer.assetId         ?? transfer.asset_id,
    from_location:     transfer.fromLocation    ?? transfer.from_location ?? null,
    from_country:      transfer.fromCountry     ?? transfer.from_country  ?? null,
    from_address:      transfer.fromAddress     ?? transfer.from_address  ?? null,
    to_location:       transfer.toLocation      ?? transfer.to_location,
    to_country:        transfer.toCountry       ?? transfer.to_country,
    to_address:        transfer.toAddress       ?? transfer.to_address    ?? null,
    rental_start_date: transfer.rentalStartDate ?? transfer.rental_start_date ?? null,
    rental_end_date:   transfer.rentalEndDate   ?? transfer.rental_end_date   ?? null,
    rental_start_time: transfer.rentalStartTime ?? transfer.rental_start_time ?? null,
    rental_end_time:   transfer.rentalEndTime   ?? transfer.rental_end_time   ?? null,
    ts:                transfer.ts,
  };
  const { data } = await runWithOptionalColumnFallback(
    "insertTransfer",
    "transfers",
    row,
    ["from_address", "to_address", "rental_start_date", "rental_end_date", "rental_start_time", "rental_end_time"],
    (currentRow) => supabase.from("transfers").insert([currentRow]).select().single()
  );
  return dbToTransfer(data);
}

// ── MAPPING HELPERS ──────────────────────────────────────────────────────────
// DB uses snake_case; app uses camelCase

function assetToDb(a, forInsert = false) {
  const row = {
    id:                a.id,
    asset_id:          a.assetId        ?? null,
    plate:             a.plate          ?? null,
    brand:             a.brand,
    model:             a.model,
    category:          a.category,
    status:            a.status,
    country:           a.country        ?? null,
    location:          a.location       ?? null,
    location_id:       a.locationId     ?? null,
    description:       a.description    ?? null,
    rental_start_date: a.rentalStartDate ?? null,
    rental_end_date:   a.rentalEndDate   ?? null,
    rental_start_time: a.rentalStartTime ?? null,
    rental_end_time:   a.rentalEndTime   ?? null,
    has_telemetry:     a.hasTelemetry   ?? false,
    flespi_device_id:  a.flespiDeviceId ?? null,
    gps_provider:      a.gpsProvider    ?? 'flespi',
    profile_photo:     extractOriginalRemoteUrl(a.profilePhotoSource ?? a.profilePhoto ?? null) || null,
    profile_photo_path:a.profilePhotoPath ?? null,
    docs:              normalizeRemoteFileList(a.docs ?? []),
    invoices:          normalizeRemoteFileList(a.invoices ?? []),
    repairs:           normalizeRemoteFileList(a.repairs ?? []),
    accessories:       normalizeRemoteFileList(a.accessories ?? []),
  };
  // Only include created_at on insert, not update
  if (forInsert) row.created_at = a.createdAt ?? new Date().toISOString();
  return row;
}

function dbToAsset(r) {
  const profilePhotoSource = extractOriginalRemoteUrl(r.profile_photo);
  return {
    id:              r.id,
    assetId:         r.asset_id,
    plate:           r.plate,
    brand:           r.brand,
    model:           r.model,
    category:        r.category,
    status:          r.status,
    country:         r.country,
    location:        r.location,
    locationId:      r.location_id,
    description:     r.description,
    rentalStartDate: r.rental_start_date,
    rentalEndDate:   r.rental_end_date,
    rentalStartTime: r.rental_start_time,
    rentalEndTime:   r.rental_end_time,
    hasTelemetry:    r.has_telemetry,
    flespiDeviceId:  r.flespi_device_id,
    gpsProvider:     r.gps_provider ?? 'flespi',
    profilePhoto:    toDisplayableRemoteUrl(profilePhotoSource, `${r.brand || "activo"}-${r.model || "foto"}`, {
      type: inferRemoteTypeFromValue(profilePhotoSource, `${r.brand || "activo"}-${r.model || "foto"}`),
    }),
    profilePhotoSource,
    profilePhotoPath:r.profile_photo_path,
    docs:            normalizeRemoteFileList(safeParse(r.docs,        [])),
    invoices:        normalizeRemoteFileList(safeParse(r.invoices,    [])),
    repairs:         normalizeRemoteFileList(safeParse(r.repairs,     [])),
    accessories:     normalizeRemoteFileList(safeParse(r.accessories, [])),
    createdAt:       r.created_at,
  };
}

function locationToDb(l) {
  return {
    id:          l.id,
    name:        l.name,
    country:     l.country,
    address:     l.address     ?? null,
    description: l.description ?? null,
    rental_start_date: l.rentalStartDate ?? null,
    rental_end_date:   l.rentalEndDate   ?? null,
    created_at:  l.createdAt   ?? new Date().toISOString(),
  };
}

function dbToLocation(r) {
  return {
    id:          r.id,
    name:        r.name,
    country:     r.country,
    address:     r.address,
    description: r.description,
    rentalStartDate: r.rental_start_date,
    rentalEndDate:   r.rental_end_date,
    createdAt:   r.created_at,
  };
}

function safeParse(val, fallback) {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

// ── CATEGORIES ───────────────────────────────────────────────────────────────
export async function dbFetchCategories() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories").select("*").order("name");
  if (error) {
    const missingTable = getMissingPublicTable(error);
    if (missingTable === "categories") {
      console.warn("[DB] fetchCategories: categories table missing in Supabase");
      return [];
    }
    console.error("[DB] fetchCategories:", error.message);
    return [];
  }
  return data;
}
export async function dbInsertCategory(cat) {
  if (!supabase) return cat;
  const { data, error } = await supabase
    .from("categories").insert([cat]).select();
  if (error) throwFriendlySchemaError("insertCategory", error);
  return data?.[0] ?? cat;
}
export async function dbUpdateCategory(cat) {
  if (!supabase) return cat;
  const { data, error } = await supabase
    .from("categories").update({ name: cat.name, color: cat.color })
    .eq("id", cat.id).select();
  if (error) throwFriendlySchemaError("updateCategory", error);
  if (data?.[0]) return data[0];

  const readBack = await supabase
    .from("categories")
    .select("*")
    .eq("id", cat.id)
    .maybeSingle();

  if (readBack.error) throwFriendlySchemaError("updateCategory", readBack.error);
  return readBack.data ?? cat;
}
export async function dbDeleteCategory(id) {
  if (!supabase) return;
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throwFriendlySchemaError("deleteCategory", error);
}

// AUDIT LOGS
function dbToAuditLog(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    details: row.details ?? {},
    createdAt: row.created_at,
  };
}

function countryToDb(country) {
  return {
    id: country.id,
    name: country.name,
    flag: country.flag,
    created_at: country.createdAt ?? new Date().toISOString(),
  };
}

function dbToCountry(row) {
  return {
    id: row.id,
    name: row.name,
    flag: row.flag,
    createdAt: row.created_at,
  };
}

function auditLogToDb(log) {
  return {
    id: log.id,
    user_id: log.userId ?? null,
    user_email: log.userEmail ?? null,
    user_name: log.userName ?? null,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId ?? null,
    entity_label: log.entityLabel ?? null,
    details: log.details ?? {},
    created_at: log.createdAt ?? new Date().toISOString(),
  };
}

export async function dbFetchAuditLogs() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingPublicTable(error, "audit_logs")) {
      throw new Error(
        "La tabla 'audit_logs' no existe en Supabase todavia. Ejecuta la migracion `supabase-audit-logs-migration.sql` en el SQL Editor y vuelve a intentar."
      );
    }
    throwDbError("fetchAuditLogs", error);
  }

  return data.map(dbToAuditLog);
}

export async function dbInsertAuditLog(log) {
  if (!supabase) return log;
  const row = auditLogToDb(log);
  const { data, error } = await supabase
    .from("audit_logs")
    .insert([row])
    .select()
    .single();

  if (error) {
    if (isMissingPublicTable(error, "audit_logs")) {
      console.warn("[DB] audit_logs table missing; activity entry skipped");
      return log;
    }
    console.error("[DB] insertAuditLog:", getErrorMessage("insertAuditLog", error));
    return log;
  }

  return dbToAuditLog(data);
}
