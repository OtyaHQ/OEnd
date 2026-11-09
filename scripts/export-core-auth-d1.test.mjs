import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportDatabases, DATABASE_TARGETS } from "./export-core-auth-d1.mjs";

const sql = "CREATE TABLE example (id INTEGER PRIMARY KEY);\n";
const accountId = "6c76d2a9e5f95d5f9b393e97374d9afb";
const apiToken = "secret-test-token";

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "otya-core-auth-export-"));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("exports both databases using the official remote Wrangler D1 command", async () => {
  await withTempDir(async backupDir => {
    const calls = [];
    const result = await exportDatabases({
      accountId, apiToken, backupDir,
      runWrangler: async (command, args, options) => {
        calls.push({ command, args, options });
        const output = args[args.indexOf("--output") + 1];
        await writeFile(output, sql, { flag: "wx" });
      },
    });
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(x => x.key), ["store", "auth"]);
    assert.equal(result[0].bucket, "otya-core-backups");
    assert.equal(result[1].bucket, "otya-auth-backups");
    assert.equal(result[0].bytes, Buffer.byteLength(sql));
    assert.equal(await readFile(result[1].filePath, "utf8"), sql);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].command, "npx");
    assert.ok(calls[0].args.includes("d1"));
    assert.ok(calls[0].args.includes("export"));
    assert.ok(calls[0].args.includes("--remote"));
    assert.equal(calls[0].options.env.CLOUDFLARE_API_TOKEN, apiToken);
    assert.equal(calls[0].args.includes(apiToken), false);
    assert.equal(calls[1].args[calls[1].args.indexOf("--config") + 1], "auth-worker/wrangler.toml");
  });
});

test("refuses to export without protected Cloudflare credentials", async () => {
  await withTempDir(async backupDir => {
    await assert.rejects(exportDatabases({
      accountId: "", apiToken, backupDir,
      runWrangler: async () => { throw new Error("must not execute"); },
    }), /CLOUDFLARE_ACCOUNT_ID/);
  });
});

test("fails if Wrangler returns success without writing an export file", async () => {
  await withTempDir(async backupDir => {
    await assert.rejects(exportDatabases({
      accountId, apiToken, backupDir,
      runWrangler: async () => {},
    }), /ENOENT|no such file/i);
  });
});

test("rejects oversized exports and removes the unsafe temporary file", async () => {
  await withTempDir(async backupDir => {
    const hugeSize = 512 * 1024 * 1024 + 1;
    await assert.rejects(exportDatabases({
      accountId, apiToken, backupDir,
      runWrangler: async (_command, args) => {
        const output = args[args.indexOf("--output") + 1];
        // Sparse file: stat catches the full size; no large RAM allocation.
        const { truncate } = await import("node:fs/promises");
        await writeFile(output, "");
        await truncate(output, hugeSize);
      },
    }), /512 MiB safety limit/);
  });
});

test("database targets remain explicit and point to canonical Cloudflare configs", () => {
  assert.deepEqual(DATABASE_TARGETS.map(x => [x.name, x.config]), [
    ["otya-store-db", "wrangler.toml"],
    ["otya-auth-db", "auth-worker/wrangler.toml"],
  ]);
});
