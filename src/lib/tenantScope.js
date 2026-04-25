let currentTenantScope = {
  companyId: "",
  companySlug: "",
};

export function setActiveTenantScope(scope = {}) {
  currentTenantScope = {
    companyId: scope.companyId || "",
    companySlug: scope.companySlug || "",
  };
}

export function getActiveTenantScope() {
  return currentTenantScope;
}

export function buildTenantStoragePath(...segments) {
  const prefix = currentTenantScope.companyId || "shared";
  return [prefix, ...segments].filter(Boolean).join("/");
}
