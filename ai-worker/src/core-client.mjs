const ALLOWED = new Set([
  "operations-snapshot",
  "feedback",
  "crashes",
  "releases",
  "feedback/classify",
  "crashes/group",
]);

export async function coreRequest(env, path, options = {}) {
  const relativePath = String(path || "").replace(/^\/+/, "");
  if (!ALLOWED.has(relativePath)) throw new Error("core_api_path_not_allowed");
  if (!env?.CORE || typeof env.CORE.fetch !== "function") throw new Error("core_service_unavailable");
  const token = String(env.OTYA_AI_CORE_SERVICE_TOKEN || "");
  if (token.length < 32) throw new Error("core_service_auth_not_configured");

  const method = String(options.method || "GET").toUpperCase();
  const isWrite = method === "POST";
  if (isWrite && !["feedback/classify", "crashes/group"].includes(relativePath)) {
    throw new Error("core_api_write_not_allowed");
  }
  if (!isWrite && method !== "GET") throw new Error("core_api_method_not_allowed");

  const headers = new Headers({
    "accept": "application/json",
    "x-otya-ai-core-token": token,
  });
  let body;
  if (isWrite) {
    body = JSON.stringify(options.body || {});
    if (body.length > 6000) throw new Error("core_api_payload_too_large");
    headers.set("content-type", "application/json");
  }
  const response = await env.CORE.fetch(new Request(
    "https://otya-core/internal/ai/" + relativePath,
    { method, headers, body },
  ));
  if (!response.ok) throw new Error("core_api_request_failed_" + response.status);
  const result = await response.json();
  if (!result || result.ok !== true) throw new Error("core_api_invalid_response");
  return result;
}
