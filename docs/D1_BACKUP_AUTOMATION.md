# Otya Core and Auth D1 backups

This workflow backs up the two shared production D1 databases:

- `otya-store-db` → private R2 bucket `otya-core-backups` (bucket location ENAM).
- `otya-auth-db` → private R2 bucket `otya-auth-backups` (bucket location WEUR).

The buckets were created in the same Cloudflare account on 2026-11-09. Both use the default R2 jurisdiction; neither has a public `r2.dev` domain or custom domain configured.

## Workflow behavior

`.github/workflows/backup-core-auth-d1.yml` runs daily at 04:15 UTC and can be manually dispatched from `main`. The script starts a consistent D1 polling export for each database, polls until Cloudflare provides a signed export URL, streams the SQL into a temporary runner file, calculates SHA-256, and emits object keys and checksums. The workflow uploads each dump to the matching private R2 bucket, downloads it again and verifies both checksum and byte count. Temporary SQL files are removed from the GitHub runner.

The workflow does not change database schemas, migrate data, deploy Workers, or delete old backups. It does not expose signed URLs or secrets in logs. Retention is deliberately unlimited until an independent retention and restore policy is approved.

## Required GitHub Actions credentials

Configure repository secrets in **OtyaEnd → Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token needs Cloudflare D1 Write (the D1 export operation locks the database while it exports) and Workers R2 Storage Read + Workers R2 Storage Write for `otya-core-backups` and `otya-auth-backups`. Scope it to this account and the two backup buckets where supported. Never use an account-global token or place it in Git, a Wrangler variable, logs, or chat.

The first scheduled/manual run is the acceptance step. A workflow file and empty R2 buckets do not prove that backups have succeeded. After a green run, perform a separate restore drill into disposable D1 databases and verify the migration ledger, tables, and application invariants before treating the backups as restore-certified.
