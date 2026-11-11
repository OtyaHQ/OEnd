import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../wrangler.separated.toml", import.meta.url), "utf8");

test("private Otya Next uses its own D1 and KV, not Core storage", () => {
  assert.match(config, /database_name\s*=\s*["']otya-next-db["']/);
  assert.doesNotMatch(config, /otya-store-db|3f179286e0fc4dbfa2332884cdf81312/);
  assert.match(config, /binding\s*=\s*["']CORE["']/);
  assert.match(config, /service\s*=\s*["']otya-core["']/);
});

test("private Otya Next manifest does not configure public guest chat models", () => {
  assert.doesNotMatch(config, /AI_PUBLIC_MODELS|AI_GUEST_MODEL/);
});
