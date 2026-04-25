import { mergeCompanyBranding } from "./companyConfig";

function ensureHeadLink(rel) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  return element;
}

function ensureMeta(name) {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  return element;
}

export function buildManifestObject(branding) {
  return {
    name: branding.appName,
    short_name: branding.appName,
    description: branding.appSubtitle || branding.appName,
    start_url: "/",
    display: "standalone",
    background_color: branding.themeColor,
    theme_color: branding.themeColor,
    orientation: "any",
    scope: "/",
    icons: [
      {
        src: branding.logoIcon192 || "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: branding.logoIcon512 || "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}

export function applyBrandingToDocument(nextBranding = {}, companyName = "") {
  if (typeof document === "undefined") return () => {};

  const branding = mergeCompanyBranding(nextBranding, companyName);
  const iconHref = branding.logoIcon32 || branding.logoIcon192 || "/icon-192.png";
  const appleIconHref = branding.logoIcon192 || iconHref;
  const themeColor = branding.themeColor || "#0f1f38";

  document.title = branding.appName || "Gestion de Activos";
  ensureHeadLink("icon").setAttribute("href", iconHref);
  ensureHeadLink("apple-touch-icon").setAttribute("href", appleIconHref);
  ensureMeta("theme-color").setAttribute("content", themeColor);

  const manifestBlob = new Blob([JSON.stringify(buildManifestObject(branding))], {
    type: "application/manifest+json",
  });
  const manifestUrl = URL.createObjectURL(manifestBlob);
  ensureHeadLink("manifest").setAttribute("href", manifestUrl);

  return () => URL.revokeObjectURL(manifestUrl);
}
