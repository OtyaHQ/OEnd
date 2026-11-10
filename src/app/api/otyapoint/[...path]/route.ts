import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  allowedOtyaPointQueryKeys,
  isAllowedOtyaPointRoute,
  isSafeOtyaPointMutation,
  parseOtyaPointBootstrapBody,
} from "@/lib/otyapoint-contract.mjs";

export const dynamic = "force-dynamic";

const ACCESS_COOKIE = "__Secure-otya_access";
const REFRESH_COOKIE = "__Secure-otya_refresh";
const COOKIE_DOMAIN = ".petersmartlink.com";
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 64 * 1024;

type ServiceBinding = { fetch(request: Request): Promise<Response> };
type OtyaBindings = { AUTH?: ServiceBinding; OTYAPOINT_API?: ServiceBinding };

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    domain: COOKIE_DOMAIN,
    path: "/",
    maxAge,
  };
}

function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken?: string,
) {
  response.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
  }
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
}

async function getBindings(): Promise<OtyaBindings> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as OtyaBindings;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function refreshAccessToken(
  auth: ServiceBinding,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  if (!refreshToken || refreshToken.length > 512) return null;
  try {
    const upstream = await auth.fetch(new Request("https://auth/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }));
    if (!upstream.ok) return null;
    const data = await readJson(upstream);
    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const rotatedRefresh = typeof data.refresh_token === "string" ? data.refresh_token : undefined;
    return accessToken ? { accessToken, refreshToken: rotatedRefresh } : null;
  } catch {
    return null;
  }
}

async function requireVerifiedOtyaEmail(auth: ServiceBinding, accessToken: string): Promise<boolean> {
  try {
    const upstream = await auth.fetch(new Request("https://auth/auth/account", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }));
    if (!upstream.ok) return false;
    const data = await readJson(upstream);
    const user = data.user && typeof data.user === "object"
      ? data.user as Record<string, unknown>
      : {};
    return user.is_verified === true || user.is_verified === 1 || user.is_verified === "1";
  } catch {
    return false;
  }
}

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Vary": "Cookie",
      },
    },
  );
}

async function readRequestBody(request: NextRequest): Promise<Uint8Array | NextResponse> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError("content_type_must_be_json", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_BYTES) return jsonError("request_too_large", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return jsonError("request_too_large", 413);
  return bytes;
}

async function proxyOtyaPoint(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const sourceUrl = new URL(request.url);
  const { path: segments } = await context.params;
  const apiPath = Array.isArray(segments) ? segments.join("/") : "";
  const method = request.method.toUpperCase();

  if (!apiPath || !isAllowedOtyaPointRoute(method, apiPath)) {
    return jsonError("not_found", 404);
  }

  if (method === "POST" && !isSafeOtyaPointMutation(
    request.headers.get("origin"),
    sourceUrl.origin,
    request.headers.get("sec-fetch-site"),
  )) {
    return jsonError("invalid_origin", 403);
  }

  const queryAllowlist = allowedOtyaPointQueryKeys(apiPath);
  const seenQueryKeys = new Set<string>();
  for (const key of new URLSearchParams(sourceUrl.search).keys()) {
    if (!queryAllowlist.has(key) || seenQueryKeys.has(key)) {
      return jsonError("unsupported_query_parameter", 400);
    }
    seenQueryKeys.add(key);
  }

  const bindings = await getBindings();
  if (!bindings.AUTH?.fetch || !bindings.OTYAPOINT_API?.fetch) {
    return jsonError("otyapoint_service_unavailable", 503);
  }

  const initialAccess = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refreshCookie = request.cookies.get(REFRESH_COOKIE)?.value ?? "";
  let accessToken = initialAccess;
  let refreshed: { accessToken: string; refreshToken?: string } | null = null;

  if (!accessToken && refreshCookie) {
    refreshed = await refreshAccessToken(bindings.AUTH, refreshCookie);
    accessToken = refreshed?.accessToken ?? "";
  }
  if (!accessToken) {
    const response = jsonError("authentication_required", 401, {
      signInUrl: "/sign-in?next=%2Fotyapoint%2Fworkspace",
    });
    clearSessionCookies(response);
    return response;
  }

  let bodyBytes: Uint8Array | undefined;
  let bootstrapKey = "";
  if (method === "POST" && apiPath === "api/bootstrap/sovereign") {
    const bytes = await readRequestBody(request);
    if (bytes instanceof NextResponse) return bytes;
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return jsonError("invalid_json", 400); }
    const bootstrap = parseOtyaPointBootstrapBody(parsed);
    if (!bootstrap.ok) return jsonError(bootstrap.code, 400);
    bootstrapKey = bootstrap.bootstrapKey;
    bodyBytes = new TextEncoder().encode(JSON.stringify({ displayName: bootstrap.displayName }));

    if (!(await requireVerifiedOtyaEmail(bindings.AUTH, accessToken))) {
      bootstrapKey = "";
      return jsonError("verified_otya_email_required", 403);
    }
  }

  const target = new URL(`https://otyapoint-api/${apiPath}`);
  target.search = sourceUrl.search;

  const makeUpstreamRequest = (token: string) => {
    const headers = new Headers({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    });
    if (bodyBytes) headers.set("Content-Type", "application/json");
    if (bootstrapKey) headers.set("x-otyapoint-bootstrap-key", bootstrapKey);
    return new Request(target.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : bodyBytes,
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  };

  let upstream: Response;
  try {
    upstream = await bindings.OTYAPOINT_API.fetch(makeUpstreamRequest(accessToken));
    if (upstream.status === 401) {
      refreshed = await refreshAccessToken(bindings.AUTH, refreshCookie);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        upstream = await bindings.OTYAPOINT_API.fetch(makeUpstreamRequest(accessToken));
      }
    }
  } catch {
    bootstrapKey = "";
    return jsonError("otyapoint_private_api_unavailable", 503);
  }
  // The key is used only to build the request header; it is never included in
  // a response, a log record, a query string, or browser storage.
  bootstrapKey = "";

  const data = await readJson(upstream);
  const response = NextResponse.json(data, {
    status: upstream.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Vary": "Cookie",
    },
  });

  if (refreshed) setSessionCookies(response, accessToken, refreshed.refreshToken);
  if (upstream.status === 401) clearSessionCookies(response);
  const requestId = request.headers.get("CF-Ray");
  if (requestId) response.headers.set("X-Otya-Request-Id", requestId);
  return response;
}

export const GET = proxyOtyaPoint;
export const POST = proxyOtyaPoint;
