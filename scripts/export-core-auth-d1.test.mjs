import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportDatabase } from "./export-core-auth-d1.mjs";

const accountId = "6c76d2a9e5f95d5f9b393e97374d9afb";
const apiToken = "test-token";
const database = { name: "otya-store-db", id: "ab157fc6-2cbb-4d46-9789-2e4392e16aea" };
const bookmark = "00000017-00000000-0000511e-cc513c61d018459ac4d53ffe9b658495";
const sql = "CREATE TABLE example (id INTEGER PRIMARY KEY);\n";

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("exports a completed D1 snapshot and calculates a stable SHA-256", async () => {
  const dir = await mkdtemp(join(tmpdir(), "otya-d1-backup-"));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
    if (String(url).includes("/export")) {
      return response({
        success: true,
        result: {
          at_bookmark: bookmark,
          status: "complete",
          result: { signed_url: "https://example.r2.cloudflarestorage.com/dump.sql" },
        },
      });
    }
    return new Response(sql, { status: 200 });
  };

  try {
    const result = await exportDatabase({
      accountId,
      apiToken,
      database,
      backupDir: dir,
      date: "2026-11-09",
      fetchImpl,
    });
    assert.equal(result.database, "otya-store-db");
    assert.equal(result.objectKey, `d1/otya-store-db/2026-11-09/backup-${bookmark}.sql`);
    assert.equal(result.bytes, Buffer.byteLength(sql));
    assert.equal(result.sha256, "dbeb9e3bf28a4d9cba73db3e6ccb5a125b20645741137adfbe56afae0a10b181");
    assert.equal(await readFile(result.filePath, "utf8"), sql);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].body, { output_format: "polling" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("polls until the signed export URL becomes available", async () => {
  const dir = await mkdtemp(join(tmpdir(), "otya-d1-poll-"));
  let call = 0;
  try {
    const result = await exportDatabase({
      accountId,
      apiToken,
      database,
      backupDir: dir,
      date: "2026-11-09",
      sleep: async () => {},
      fetchImpl: async (url) => {
        if (!String(url).includes("/export")) return new Response(sql);
        call += 1;
        return response({
          success: true,
          result: call === 1
            ? { at_bookmark: bookmark, status: "running" }
            : { at_bookmark: bookmark, status: "complete", result: { signed_url: "https://example.r2.cloudflarestorage.com/dump.sql" } },
        });
      },
      pollAttempts: 3,
    });
    assert.equal(call, 2);
    assert.equal(result.bytes, Buffer.byteLength(sql));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fails closed when Cloudflare rejects the export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "otya-d1-reject-"));
  try {
    await assert.rejects(
      exportDatabase({
        accountId,
        apiToken,
        database,
        backupDir: dir,
        fetchImpl: async () => response({ success: false, errors: [{ code: 9109 }] }, 403),
      }),
      /failed with HTTP 403/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects untrusted export URLs before downloading", async () => {
  const dir = await mkdtemp(join(tmpdir(), "otya-d1-host-"));
  try {
    await assert.rejects(
      exportDatabase({
        accountId,
        apiToken,
        database,
        backupDir: dir,
        fetchImpl: async () => response({
          success: true,
          result: { at_bookmark: bookmark, status: "complete", result: { signed_url: "https://attacker.invalid/dump.sql" } },
        }),
      }),
      /untrusted download host/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("times out when the export never becomes ready", async () => {
  const dir = await mkdtemp(join(tmpdir(), "otya-d1-timeout-"));
  let call = 0;
  try {
    await assert.rejects(
      exportDatabase({
        accountId,
        apiToken,
        database,
        backupDir: dir,
        sleep: async () => {},
        pollAttempts: 2,
        fetchImpl: async () => {
          call += 1;
          return response({
            success: true,
            result: call === 1
              ? { at_bookmark: bookmark, status: "running" }
              : { at_bookmark: bookmark, status: "running" },
          });
        },
      }),
      /timed out/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
