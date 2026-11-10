export const OTYAPOINT_READ_ROUTES = new Set([
  "api/me",
  "api/products",
  "api/summary",
  "api/ledger",
  "api/staff",
  "api/staff/invitations",
  "api/agency-readiness",
  "api/agency-overview",
]);

export const OTYAPOINT_POST_ROUTES = new Set([
  "api/bootstrap/sovereign",
  "api/integrations/quickteller/sandbox-auth",
]);

const QUERY_KEYS = new Map([
  ["api/staff", new Set(["status"])],
  ["api/ledger", new Set(["type"])],
]);

export function isAllowedOtyaPointRoute(method, path) {
  if (method === "GET") return OTYAPOINT_READ_ROUTES.has(path);
  if (method === "POST") return OTYAPOINT_POST_ROUTES.has(path);
  return false;
}

export function isSafeOtyaPointMutation(origin, requestOrigin, fetchSite) {
  if (typeof origin !== "string" || !origin || origin !== requestOrigin) return false;
  return fetchSite == null || fetchSite === "" || fetchSite === "same-origin";
}

export function allowedOtyaPointQueryKeys(path) {
  return QUERY_KEYS.get(path) ?? new Set();
}

export function parseOtyaPointBootstrapBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_body" };
  }
  const bootstrapKey = typeof value.bootstrapKey === "string" ? value.bootstrapKey : "";
  if (bootstrapKey.length < 32 || bootstrapKey.length > 512) {
    return { ok: false, code: "invalid_bootstrap_key" };
  }
  const displayName = typeof value.displayName === "string"
    ? value.displayName.trim().slice(0, 120)
    : "";
  return {
    ok: true,
    bootstrapKey,
    displayName: displayName || "OtyaPoint Owner",
  };
}
