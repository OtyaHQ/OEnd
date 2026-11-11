import test from "node:test";
import assert from "node:assert/strict";
import { handleAiInternalRequest } from "../../src/lib/ai-internal-api.mjs";

test("Core AI data API rejects requests without the private service token", async () => {
  const response = await handleAiInternalRequest(new Request("https://core/internal/ai/operations-snapshot"), {});
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});

test("Core AI data API fails closed when Core D1 is not bound", async () => {
  const response = await handleAiInternalRequest(
    new Request("https://core/internal/ai/operations-snapshot", { headers: { "x-otya-ai-core-token": "s".repeat(40) } }),
    { OTYA_AI_CORE_SERVICE_TOKEN: "s".repeat(40) },
  );
  assert.equal(response.status, 503);
});
