import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const secure = await readFile(new URL("../src/production-entrypoint-secure.ts", import.meta.url), "utf8");
const base = await readFile(new URL("../src/production-entrypoint.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("Auth deployment uses the secure entrypoint", () => {
  assert.match(config, /main\s*=\s*["']src\/production-entrypoint-secure\.ts["']/);
});

test("legacy Telegram sign-in routes are denied before Auth routing", () => {
  assert.match(secure, /pathname\.startsWith\(["']\/auth\/telegram["']\)/);
  assert.match(secure, /telegram_sign_in_disabled/);
  assert.match(secure, /status:\s*410/);
});

test("the base Auth entrypoint has no Telegram Login handler import or call", () => {
  assert.doesNotMatch(base, /handleTelegramLogin|TelegramLoginEnv/);
});

test("the secure entrypoint does not import Mini App or Telegram primary login modules", () => {
  assert.doesNotMatch(secure, /telegram-miniapp|telegram-primary-login|telegram-login/);
});
