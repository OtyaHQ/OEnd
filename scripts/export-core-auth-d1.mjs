import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, appendFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_BACKUP_BYTES = 512 * 1024 * 1024;

export const DATABASE_TARGETS = Object.freeze([
  { key: "store", name: "otya-store-db", config: "wrangler.toml", bucket: "otya-core-backups" },
  { key: "auth", name: "otya-auth-db", config: "auth-worker/wrangler.toml", bucket: "otya-auth-backups" },
]);

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required configuration: ${name}`);
  }
  return value.trim();
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    bytes += chunk.length;
    if (bytes > MAX_BACKUP_BYTES) {
      throw new Error("D1 export exceeds the configured 512 MiB safety limit.");
    }
    hash.update(chunk);
  }
  if (bytes < 1) throw new Error("D1 export file is empty.");
  return { bytes, sha256: hash.digest("hex") };
}

async function invokeWrangler({ database, outputPath, accountId, apiToken, runWrangler }) {
  const args = [
    "--yes", "wrangler@4.158.0",
    "d1", "export", database.name,
    "--remote",
    "--output", outputPath,
    "--skip-confirmation",
    "--config", database.config,
  ];
  await runWrangler("npx", args, {
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      CLOUDFLARE_API_TOKEN: apiToken,
    },
    timeout: 10 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
}

export async function exportDatabases({
  accountId,
  apiToken,
  backupDir,
  runWrangler = (command, args, options) => execFileAsync(command, args, options),
}) {
  accountId = requireText(accountId, "CLOUDFLARE_ACCOUNT_ID");
  apiToken = requireText(apiToken, "CLOUDFLARE_API_TOKEN");
  if (typeof runWrangler !== "function") throw new TypeError("runWrangler must be a function.");
  await mkdir(backupDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const database of DATABASE_TARGETS) {
    const outputPath = join(backupDir, `backup-${database.key}-${date}.sql`);
    await rm(outputPath, { force: true });
    await invokeWrangler({
      database,
      outputPath,
      accountId,
      apiToken,
      runWrangler,
    });
    try {
      const fileStats = await stat(outputPath);
      if (!fileStats.isFile()) throw new Error("Wrangler did not produce a regular SQL file.");
      if (fileStats.size > MAX_BACKUP_BYTES) {
        throw new Error("D1 export exceeds the configured 512 MiB safety limit.");
      }
      const digest = await hashFile(outputPath);
      if (fileStats.size !== digest.bytes) throw new Error("D1 export size verification failed.");
      results.push({
        key: database.key,
        database: database.name,
        bucket: database.bucket,
        objectKey: `d1/${database.name}/${date}/backup-${date}-${digest.sha256.slice(0, 16)}.sql`,
        filePath: outputPath,
        bytes: digest.bytes,
        sha256: digest.sha256,
      });
    } catch (error) {
      await rm(outputPath, { force: true }).catch(() => {});
      throw error;
    }
  }
  return results;
}

async function main() {
  const outputs = await exportDatabases({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    backupDir: process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp",
  });
  if (process.env.GITHUB_OUTPUT) {
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
      `Prepared ${item.database}: ${item.bytes} bytes; SHA-256 ${item.sha256}.\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`D1 backup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
