/**
 * Supabase Storage helpers
 * Bucket: "fleetcore-files"
 * Folder structure: {assetId}/{category}/{filename}
 * Categories: docs | invoices | repairs | accessories | photos
 */
import { supabase } from "./supabase";
import { buildTenantStoragePath } from "./tenantScope";

const BUCKET = "fleetcore-files";

/**
 * Upload a file (from base64 data URL or File object) to Supabase Storage.
 * Returns the public URL or null on failure.
 */
export async function uploadFile({ assetId, category, name, dataUrl, type }) {
  if (!supabase) return null;

  // Convert base64 data URL → Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const path = buildTenantStoragePath("assets", assetId, category, `${Date.now()}_${name}`);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: type, upsert: true });

  if (error) { console.error("[Storage] upload error:", error.message); return null; }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { path: data.path, url: publicUrl };
}

/**
 * Delete a file from Storage by its path.
 */
export async function deleteFile(path) {
  if (!supabase || !path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("[Storage] delete error:", error.message);
}

export async function deleteFiles(paths) {
  const valid = [...new Set((paths || []).filter(Boolean))];
  if (!supabase || !valid.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(valid);
  if (error) console.error("[Storage] bulk delete error:", error.message);
}

export function collectAssetStoragePaths(asset) {
  if (!asset) return [];
  const fileGroups = [asset.docs, asset.invoices, asset.repairs, asset.accessories]
    .flat()
    .filter(Boolean)
    .map((file) => file.path)
    .filter(Boolean);
  return [...new Set([asset.profilePhotoPath, ...fileGroups].filter(Boolean))];
}

export function diffRemovedAssetStoragePaths(previous, next) {
  const before = new Set(collectAssetStoragePaths(previous));
  const after = new Set(collectAssetStoragePaths(next));
  return [...before].filter((path) => !after.has(path));
}

/**
 * Upload all file arrays for an asset.
 * Returns updated file arrays with {name, size, type, url, path} — no base64.
 */
export async function uploadAssetFiles(assetId, form) {
  const categories = ["docs", "invoices", "repairs", "accessories"];
  const result = {};

  for (const cat of categories) {
    const files = form[cat] ?? [];
    result[cat] = await Promise.all(
      files.map(async (f) => {
        // Already uploaded (has url, no data) — keep as-is
        if ((f.url || f.sourceUrl) && !f.data) return f;
        if (!f.data) return f;
        const uploaded = await uploadFile({ assetId, category: cat, name: f.name, dataUrl: f.data, type: f.type });
        if (!uploaded) return f; // fallback: keep base64
        return { name: f.name, size: f.size, type: f.type, url: uploaded.url, path: uploaded.path };
      })
    );
  }

  // Profile photo
  if (form.profilePhoto?.startsWith("data:")) {
    const uploaded = await uploadFile({
      assetId, category: "photos", name: "profile.jpg",
      dataUrl: form.profilePhoto, type: "image/jpeg",
    });
    result.profilePhoto = uploaded?.url ?? form.profilePhoto;
    result.profilePhotoPath = uploaded?.path;
  } else {
    result.profilePhoto = form.profilePhoto;
  }

  return result;
}
