import test from "node:test";
import assert from "node:assert/strict";
import { coreRequest } from "../src/core-client.mjs";

test("requires a Core service binding and dedicated service token", async () => {
  await assert.rejects(() => coreRequest({}, "operations-snapshot"), /core_service_unavailable/);
  await assert.rejects(() => coreRequest({ CORE: { fetch: async () => new Response("{}") } }, "operations-snapshot"), /core_service_auth_not_configured/);
});

test("refuses unapproved paths and write methods", async () => {
  const env = { CORE: { fetch: async () => new Response('{"ok":true}') }, OTYA_AI_CORE_SERVICE_TOKEN: "x".repeat(40) };
  await assert.rejects(() => coreRequest(env, "users"), /core_api_path_not_allowed/);
  await assert.rejects(() => coreRequest(env, "feedback", { method: "POST", body: {} }), /core_api_write_not_allowed/);
});

test("uses private service binding and authenticates the request", async () => {
  let captured;
  const env = {
    OTYA_AI_CORE_SERVICE_TOKEN: "s".repeat(48),
    CORE: {
      fetch: async request => {
        captured = request;
        return new Response(JSON.stringify({ ok: true, metrics: { users: 3 } }), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  };
  const result = await coreRequest(env, "operations-snapshot");
  assert.equal(result.metrics.users, 3);
  assert.equal(captured.url, "https://otya-core/internal/ai/operations-snapshot");
  assert.equal(captured.headers.get("x-otya-ai-core-token"), "s".repeat(48));
});

test("refuses a failed Core response", async () => {
  const env = {
    OTYA_AI_CORE_SERVICE_TOKEN: "s".repeat(48),
    CORE: { fetch: async () => new Response("{}", { status: 401 }) },
  };
  await assert.rejects(() => coreRequest(env, "operations-snapshot"), /core_api_request_failed_401/);
});
