const READ_PATHS = new Set([
  "operations-snapshot",
  "feedback",
  "crashes",
  "releases",
  "downloads/hourly",
  "users/churn-candidates",
]);
const WRITE_PATHS = new Set([
  "feedback/classify",
  "crashes/group",
  "releases/changelog",
]);
const QUERY_KEYS = new Set(["window", "limit"]);

export async function coreRequest(env, path, options = {}) {
  const relativePath = String(path || "").replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..") || relativePath.includes("\\\\")) {
    throw new Error("core_api_path_not_allowed");
  }
  const method = String(options.method || "GET").toUpperCase();
  const allowed = method === "GET" ? READ_PATHS : method === "POST" ? WRITE_PATHS : null;
  if (!allowed?.has(relativePath)) throw new Error("core_api_path_not_allowed");
  if (!env?.CORE || typeof env.CORE.fetch !== "function") throw new Error("core_service_unavailable");
  const token = String(env.OTYA_AI_CORE_SERVICE_TOKEN || "");
  if (token.length < 32) throw new Error("core_service_auth_not_configured");

  const target = new URL("https://otya-end/internal/ai/" + relativePath);
  if (options.query && typeof options.query === "object") {
    for (const [key, value] of Object.entries(options.query)) {
      if (!QUERY_KEYS.has(key) || value == null) throw new Error("core_api_query_not_allowed");
      const safe = String(value);
      if (safe.length > 32 || /[\\r\\n]/.test(safe)) throw new Error("core_api_query_invalid");
      target.searchParams.set(key, safe);
    }
  }

  const headers = new Headers({
    "accept": "application/json",
    "x-otya-ai-core-token": token,
  });
  let body;
  if (method === "POST") {
    body = JSON.stringify(options.body || {});
    if (body.length > 6000) throw new Error("core_api_payload_too_large");
    headers.set("content-type", "application/json");
  }
  const upstream = await env.CORE.fetch(new Request(target, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(12000),
  }));
  if (!upstream.ok) throw new Error("core_api_request_failed_" + upstream.status);
  const result = await upstream.json();
  if (!result || result.ok !== true) throw new Error("core_api_invalid_response");
  return result;
}
