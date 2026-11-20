// app/api/internal/delete-user/route.ts
// POST /api/internal/delete-user
//
// Internal account-cleanup endpoint called by oend-identity before the identity row
// is removed. Cleanup is fail-closed: any real D1 error returns a non-2xx
// response so auth keeps the account recoverable and the user can retry.

import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB, type D1 } from '@/lib/d1'

type DeletedRow = { table: string; rows: number }
type TableInfo = { name?: string }

const DIRECT_USER_TABLES = [
  'play_history',
  'playlists',
  'bookmarks',
  'eq_presets',
  'user_preferences',
  'pro_status',
] as const

async function columnsFor(db: D1, table: string): Promise<Set<string>> {
  const { results = [] } = await db.prepare(`PRAGMA table_info(${table})`).all<TableInfo>()
  return new Set(results.map(row => String(row.name ?? '')).filter(Boolean))
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

async function deleteWhere(
  db: D1,
  table: string,
  where: string,
  bindings: unknown[],
  deleted: DeletedRow[],
): Promise<void> {
  const result = await db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...bindings).run()
  deleted.push({ table, rows: result.meta.changes ?? 0 })
}

async function countWhere(db: D1, table: string, where: string, bindings: unknown[]): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)
    .bind(...bindings)
    .first<{ count?: number }>()
  return Number(row?.count ?? 0)
}

function linkedWhere(
  columns: Set<string>,
  userId: string,
  userEmail: string | null,
  deviceIds: string[],
): { where: string; bindings: unknown[] } | null {
  const clauses: string[] = []
  const bindings: unknown[] = []

  if (columns.has('user_id')) {
    clauses.push('user_id = ?')
    bindings.push(userId)
  }
  if (columns.has('device_id') && deviceIds.length > 0) {
    clauses.push(`device_id IN (${placeholders(deviceIds.length)})`)
    bindings.push(...deviceIds)
  }
  if (columns.has('user_email') && userEmail) {
    clauses.push('lower(user_email) = ?')
    bindings.push(userEmail)
  }

  return clauses.length ? { where: clauses.map(value => `(${value})`).join(' OR '), bindings } : null
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>

  const internalSecret = recordEnv.INTERNAL_SECRET as string | undefined
  if (!internalSecret) {
    console.error('[internal/delete-user] INTERNAL_SECRET not configured')
    return errorJson('Internal server error', 500)
  }

  const providedSecret =
    req.headers.get('X-Internal-Secret') ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!providedSecret || providedSecret !== internalSecret) return errorJson('Unauthorized', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  const userEmail = typeof body.user_email === 'string' && body.user_email.trim()
    ? body.user_email.trim().toLowerCase()
    : null
  if (!userId) return errorJson('user_id is required', 400)

  const db = getDB(recordEnv)
  const deleted: DeletedRow[] = []

  try {
    const deviceColumns = await columnsFor(db, 'devices')
    let deviceIds: string[] = []
    if (deviceColumns.has('user_id') && deviceColumns.has('device_id')) {
      const { results = [] } = await db.prepare(
        'SELECT device_id FROM devices WHERE user_id = ? AND device_id IS NOT NULL'
      ).bind(userId).all<{ device_id?: string | null }>()
      deviceIds = [...new Set(results.map(row => String(row.device_id ?? '').trim()).filter(Boolean))]
    }

    // Delete feedback children before their parent rows.
    const feedbackColumns = await columnsFor(db, 'feedback')
    const feedbackLink = linkedWhere(feedbackColumns, userId, userEmail, deviceIds)
    if (feedbackLink) {
      const replyColumns = await columnsFor(db, 'feedback_replies')
      if (replyColumns.has('feedback_id')) {
        await deleteWhere(
          db,
          'feedback_replies',
          `feedback_id IN (SELECT id FROM feedback WHERE ${feedbackLink.where})`,
          feedbackLink.bindings,
          deleted,
        )
      }
      await deleteWhere(db, 'feedback', feedbackLink.where, feedbackLink.bindings, deleted)
    }

    for (const table of ['ratings', 'crash_reports'] as const) {
      const columns = await columnsFor(db, table)
      const link = linkedWhere(columns, userId, userEmail, deviceIds)
      if (link) await deleteWhere(db, table, link.where, link.bindings, deleted)
    }

    for (const table of DIRECT_USER_TABLES) {
      const columns = await columnsFor(db, table)
      if (columns.has('user_id')) await deleteWhere(db, table, 'user_id = ?', [userId], deleted)
    }

    if (deviceColumns.has('user_id')) {
      await deleteWhere(db, 'devices', 'user_id = ?', [userId], deleted)
    }

    // Verify the ownership selectors are empty before telling auth it is safe
    // to remove the account identity.
    const remaining: Array<{ table: string; rows: number }> = []
    if (feedbackLink) {
      const rows = await countWhere(db, 'feedback', feedbackLink.where, feedbackLink.bindings)
      if (rows > 0) remaining.push({ table: 'feedback', rows })
    }
    for (const table of ['ratings', 'crash_reports'] as const) {
      const columns = await columnsFor(db, table)
      const link = linkedWhere(columns, userId, userEmail, deviceIds)
      if (!link) continue
      const rows = await countWhere(db, table, link.where, link.bindings)
      if (rows > 0) remaining.push({ table, rows })
    }
    for (const table of DIRECT_USER_TABLES) {
      const columns = await columnsFor(db, table)
      if (!columns.has('user_id')) continue
      const rows = await countWhere(db, table, 'user_id = ?', [userId])
      if (rows > 0) remaining.push({ table, rows })
    }
    if (deviceColumns.has('user_id')) {
      const rows = await countWhere(db, 'devices', 'user_id = ?', [userId])
      if (rows > 0) remaining.push({ table: 'devices', rows })
    }

    if (remaining.length > 0) {
      console.error('[internal/delete-user] Cleanup verification failed:', remaining)
      return errorJson('Account data cleanup could not be verified', 503)
    }

    console.log(`[internal/delete-user] Verified product-data cleanup for user ${userId}`)
    return secureJson({ ok: true, deleted })
  } catch (error) {
    console.error('[internal/delete-user] Cleanup failed:', (error as Error)?.message)
    return errorJson('Account data cleanup failed', 503)
  }
}
