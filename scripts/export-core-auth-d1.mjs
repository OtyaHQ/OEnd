import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const MAX_POLL_ATTEMPTS = 36;
const POLL_INTERVAL_MS = 5_000;

export const DATABASE_TARGETS = Object.freeze([
  {
    key: "store",
    name: "otya-store-db",
    id: "ab157fc6-2cbb-4d46-9789-2e4392e16aea",
    bucket: "otya-core-backups",
  },
  {
    key: "auth",
    name: "otya-auth-db",
    id: "b05595f6-260a-4720-acca-4f8b13f5c43e",
    bucket: "otya-auth-backups",
  },
]);

function requireNonEmpty(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required configuration: ${name}`);
  }
  return value.trim();
}

function safeBookmark(value) {
  if (typeof value !== "string" || !/^[a-f0-9-]{16,128}$/i.test(value)) {
    throw new Error("Cloudflare returned an invalid D1 export bookmark.");
  }
  return value;
}

function safeDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid backup date.");
  }
  return value;
}

async function readJson(response, context) {
  if (!response.ok) {
    throw new Error(`${context} failed with HTTP ${response.status}.`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${context} returned invalid JSON.`);
  }
  if (!payload || typeof payload !== "object" || payload.success !== true) {
    const first = Array.isArray(payload?.errors) ? payload.errors[0] : null;
    const code = Number.isInteger(first?.code) ? ` (code ${first.code})` : "";
    throw new Error(`${context} was rejected by Cloudflare${code}.`);
  }
  return payload.result;
}

async function startOrPollExport({ endpoint, token, body, fetchImpl }) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  return readJson(response, "Cloudflare D1 export request");
}

async function downloadToFile({ url, filePath, fetchImpl, maxBytes }) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || response.status >= 300 || !response.body) {
    throw new Error(`D1 export download failed with HTTP ${response.status}.`);
  }

  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        callback(new Error("D1 export exceeds the configured 512 MiB safety limit."));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(response.body, meter, createWriteStream(filePath, { flags: "wx" }));
  if (bytes < 1) throw new Error("D1 export file is empty.");
  return { bytes, sha256: hash.digest("hex") };
}

export async function exportDatabase({
  accountId,
  apiToken,
  database,
  backupDir,
  date = new Date().toISOString().slice(0, 10),
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxBytes = MAX_BACKUP_BYTES,
  pollAttempts = MAX_POLL_ATTEMPTS,
  pollIntervalMs = POLL_INTERVAL_MS,
}) {
  accountId = requireNonEmpty(accountId, "CLOUDFLARE_ACCOUNT_ID");
  apiToken = requireNonEmpty(apiToken, "CLOUDFLARE_API_TOKEN");
  if (!database || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(database.name)) {
    throw new Error("Invalid D1 database target.");
  }
  const databaseId = requireNonEmpty(database.id, "D1 database ID");
  date = safeDate(date);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) {
    throw new Error("Invalid maximum backup size.");
  }
  if (!Number.isSafeInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 100) {
    throw new Error("Invalid export polling limit.");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/export`;
  const started = await startOrPollExport({
    endpoint,
    token: apiToken,
    body: { output_format: "polling" },
    fetchImpl,
  });
  const bookmark = safeBookmark(started?.at_bookmark);
  let current = started;

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const signedUrl = current?.result?.signed_url;
    if (current?.status === "complete" && typeof signedUrl === "string" && signedUrl.startsWith("https://")) {
      const url = new URL(signedUrl);
      if (!url.hostname.endsWith(".r2.cloudflarestorage.com")) {
        throw new Error("D1 export returned an untrusted download host.");
      }
      const safeKey = `d1/${database.name}/${date}/backup-${bookmark}.sql`;
      const filePath = join(backupDir, basename(safeKey));
      await mkdir(backupDir, { recursive: true });
      try {
        const digest = await downloadToFile({
          url: signedUrl,
          filePath,
          fetchImpl,
          maxBytes,
        });
        const fileStats = await stat(filePath);
        if (fileStats.size !== digest.bytes) throw new Error("D1 backup size verification failed.");
        return {
          key: database.key,
          database: database.name,
          objectKey: safeKey,
          filePath,
          bytes: digest.bytes,
          sha256: digest.sha256,
          bookmark,
        };
      } catch (error) {
        await rm(filePath, { force: true }).catch(() => {});
        throw error;
      }
    }

    if (current?.status === "error" || current?.status === "failed") {
      throw new Error(`Cloudflare D1 export did not complete for ${database.name}.`);
    }
    if (attempt + 1 < pollAttempts) {
      await sleep(pollIntervalMs);
      current = await startOrPollExport({
        endpoint,
        token: apiToken,
        body: { current_bookmark: bookmark },
        fetchImpl,
      });
    }
  }

  throw new Error(`Cloudflare D1 export timed out for ${database.name}.`);
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const backupDir = process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp";
  const outputs = [];

  for (const database of DATABASE_TARGETS) {
    const result = await exportDatabase({
      accountId,
      apiToken,
      database,
      backupDir,
    });
    outputs.push(result);
  }

  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    const lines = [];
    for (const item of outputs) {
      lines.push(`${item.key}_file=${item.filePath}`);
      lines.push(`${item.key}_key=${item.objectKey}`);
      lines.push(`${item.key}_bytes=${item.bytes}`);
      lines.push(`${item.key}_sha256=${item.sha256}`);
    }
    await appendFile(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n", { mode: 0o600 });
  }

  for (const item of outputs) {
    process.stdout.write(
      `Prepared ${item.database}: ${item.bytes} bytes; SHA-256 ${item.sha256}; bookmark ${item.bookmark}.\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`D1 backup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
