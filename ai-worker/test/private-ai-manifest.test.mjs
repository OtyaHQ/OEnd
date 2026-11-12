import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../wrangler.o-ai-staging.toml", import.meta.url), "utf8");

test("private Otya Next staging uses isolated D1, KV and R2 rather than Core storage", () => {
  assert.match(config, /^name\s*=\s*["']o-ai-staging["']/m);
  assert.match(config, /database_name\s*=\s*["']o-ai-staging-db["']/);
  assert.match(config, /database_id\s*=\s*["']50619fbd-098c-4f22-b038-75e7e23ee3c6["']/);
  assert.match(config, /binding\s*=\s*["']KV["'][\s\S]*?id\s*=\s*["']3f3172a64be04655a52d012efdac0648["']/);
  assert.match(config, /bucket_name\s*=\s*["']o-ai-staging-private["']/);
  assert.match(config, /binding\s*=\s*["']AUTH["'][\s\S]*?service\s*=\s*["']otya-id-staging["']/);
  assert.doesNotMatch(config, /otya-store-db|3f179286e0fc4dbfa2332884cdf81312|service\s*=\s*["']otya-core["']/);
});

test("private Otya Next staging is not configured for public guest chat", () => {
  assert.match(config, /OWNER_ONLY\s*=\s*["']true["']/);
  assert.match(config, /PUBLIC_CHAT_ENABLED\s*=\s*["']false["']/);
  assert.doesNotMatch(config, /AI_PUBLIC_MODELS|AI_GUEST_MODEL/);
});
