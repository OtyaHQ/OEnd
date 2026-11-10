/**
 * D1 schema and typed helpers for the OTYA identity service.
 *
 * Identity is shared across every OTYA product. Product-specific data stays in
 * each product service and is keyed by the stable users.id value.
 */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; last_row_id?: number } }>
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number; last_row_id?: number } }>
}

export interface D1Database {
  prepare(query: string): D1Statement
  exec(query: string): Promise<{ count: number; duration: number }>
}

export interface UserRow {
  id:                         string
  otya_id:                    string
  email:                      string | null
  password_hash:              string | null
  google_id:                  string | null
  name:                       string | null
  avatar_url:                 string | null
  is_verified:                number
  phone_number:               string | null
  phone_verified_at:          string | null
  phone_verification_method:  string | null
  recovery_email:             string | null
  recovery_email_verified_at: string | null
  country_code:               string | null
  locale:                     string | null
  timezone:                   string | null
  created_at:                 string
  updated_at:                 string
}

const USERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                         TEXT PRIMARY KEY,
  otya_id                    TEXT,
  email                      TEXT UNIQUE,
  password_hash              TEXT,
  google_id                  TEXT UNIQUE,
  name                       TEXT,
  avatar_url                 TEXT,
  is_verified                INTEGER DEFAULT 0,
  phone_number               TEXT,
  phone_verified_at          TEXT,
  phone_verification_method  TEXT,
  recovery_email             TEXT,
  recovery_email_verified_at TEXT,
  country_code               TEXT,
  locale                     TEXT,
  timezone                   TEXT,
  created_at                 TEXT DEFAULT (datetime('now')),
  updated_at                 TEXT DEFAULT (datetime('now'))
);
`.trim()

export const SCHEMA_SQL = `
${USERS_TABLE_SQL}
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);

CREATE TABLE IF NOT EXISTS user_products (
  user_id       TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_products_product ON user_products(product_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS linked_identities (
  user_id            TEXT NOT NULL,
  provider           TEXT NOT NULL,
  provider_subject   TEXT NOT NULL,
  provider_username  TEXT,
  provider_email     TEXT,
  linked_at          TEXT DEFAULT (datetime('now')),
  last_used_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_linked_identities_user ON linked_identities(user_id, provider);

-- One active, short-lived owner Telegram-link proof per account. Store only a
-- digest of the current verified email; consumption is a single D1 DELETE.
CREATE TABLE IF NOT EXISTS telegram_identity_link_proofs (
  user_id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_telegram_identity_link_proofs_expiry
  ON telegram_identity_link_proofs(expires_at);
`.trim()

const USER_COLUMN_DEFS: Record<string, string> = {
  otya_id: 'TEXT',
  password_hash: 'TEXT',
  google_id: 'TEXT',
  name: 'TEXT',
  avatar_url: 'TEXT',
  is_verified: 'INTEGER DEFAULT 0',
  phone_number: 'TEXT',
  phone_verified_at: 'TEXT',
  phone_verification_method: 'TEXT',
  recovery_email: 'TEXT',
  recovery_email_verified_at: 'TEXT',
  country_code: 'TEXT',
  locale: 'TEXT',
  timezone: 'TEXT',
  created_at: 'TEXT',
  updated_at: 'TEXT',
}

function randomBelow(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
    throw new Error('Invalid random range')
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0
    if (value < limit) return value % maxExclusive
  }
}

/**
 * Public Otya account identifier.
 *
 * Format: 2IS######## (fixed 2IS prefix + exactly eight cryptographically
 * random decimal digits). This identifier is public and human-friendly;
 * users.id remains the private/internal primary key used for joins and auth.
 */
export async function generateOtyaId(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = `2IS${randomBelow(100_000_000).toString().padStart(8, '0')}`
    const existing = await db.prepare('SELECT 1 FROM users WHERE otya_id = ? LIMIT 1').bind(candidate).first()
    if (!existing) return candidate
  }
  throw new Error('Could not allocate a unique Otya ID')
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = String(error).toLowerCase()
  return message.includes('unique constraint') || message.includes('constraint failed') || message.includes('sqlite_constraint')
}

async function ensureUserColumns(db: D1Database): Promise<void> {
  const { results } = await db.prepare('PRAGMA table_info(users)').all<{ name: string }>()
  const existing = new Set(results.map(row => row.name))
  for (const [name, type] of Object.entries(USER_COLUMN_DEFS)) {
    if (!existing.has(name)) {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run()
    }
  }

  // Preserve the eight random digits already allocated during the short-lived
  // IS######## format while moving those accounts to the final 2IS########
  // public format. IDs that were never allocated are generated below.
  await db.prepare(`
    UPDATE users
    SET otya_id = '2' || otya_id
    WHERE length(otya_id) = 10
      AND otya_id GLOB 'IS[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  `).run()

  const missing = await db.prepare(
    "SELECT id FROM users WHERE otya_id IS NULL OR trim(otya_id) = ''",
  ).all<{ id: string }>()
  for (const row of missing.results) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const otyaId = await generateOtyaId(db)
      try {
        await db.prepare('UPDATE users SET otya_id = ? WHERE id = ?').bind(otyaId, row.id).run()
        break
      } catch (error) {
        if (!isUniqueConstraintError(error) || attempt === 15) throw error
      }
    }
  }

  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_otya_id ON users(otya_id) WHERE otya_id IS NOT NULL').run()
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number) WHERE phone_number IS NOT NULL').run()
}

const REQUIRED_SCHEMA_READS = [
  `SELECT id, otya_id, email, password_hash, google_id, name, avatar_url, is_verified,
          phone_number, phone_verified_at, phone_verification_method, recovery_email,
          recovery_email_verified_at, country_code, locale, timezone, created_at, updated_at
   FROM users LIMIT 0`,
  `SELECT user_id, product_id, status, first_seen_at, last_seen_at
   FROM user_products LIMIT 0`,
  `SELECT user_id, provider, provider_subject, provider_username, provider_email, linked_at, last_used_at
   FROM linked_identities LIMIT 0`,
  `SELECT user_id, email_hash, expires_at, created_at
   FROM telegram_identity_link_proofs LIMIT 0`,
] as const

/** Read-only runtime readiness; DDL belongs to deployment repair. */
export async function assertSchemaReady(db: D1Database): Promise<void> {
  for (const query of REQUIRED_SCHEMA_READS) {
    await db.prepare(query).all()
  }
}
export async function ensureSchema(db: D1Database): Promise<void> {
  // Existing v1 D1 databases are intentionally preserved during reset. Create
  // the table if this is a fresh database, then upgrade every required user
  // column before SCHEMA_SQL attempts indexes that depend on those columns.
  // This makes startup safe for both fresh and older preserved schemas.
  await db.exec(USERS_TABLE_SQL)
  await ensureUserColumns(db)
  await db.exec(SCHEMA_SQL)
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export async function getUserByOtyaId(db: D1Database, otyaId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE otya_id = ?').bind(otyaId.trim().toUpperCase()).first<UserRow>()
}

export async function getUserByGoogleId(db: D1Database, googleId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first<UserRow>()
}

export async function insertUser(
  db: D1Database,
  user: { id: string; email: string; password_hash: string | null; google_id: string | null; name: string | null; avatar_url: string | null },
): Promise<void> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const otyaId = await generateOtyaId(db)
    try {
      await db.prepare(`
        INSERT INTO users (id, otya_id, email, password_hash, google_id, name, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user.id,
        otyaId,
        user.email,
        user.password_hash ?? null,
        user.google_id     ?? null,
        user.name          ?? null,
        user.avatar_url    ?? null,
      ).run()
      return
    } catch (error) {
      // Retry only if the public-ID unique index raced another registration.
      // Email / Google-ID conflicts must still propagate to the caller.
      const current = await getUserByEmail(db, user.email)
      if (current || !isUniqueConstraintError(error) || attempt === 15) throw error
    }
  }
}

async function refreshGoogleProfile(
  db: D1Database,
  userId: string,
  user: Pick<UserRow, 'name' | 'avatar_url'>,
): Promise<UserRow | null> {
  await db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      is_verified = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(user.name ?? null, user.avatar_url ?? null, userId).run()
  return getUserById(db, userId)
}

function assertGoogleIdentityCanLink(existing: UserRow, googleId: string): void {
  if (existing.google_id && existing.google_id !== googleId) {
    throw new Error('GOOGLE_IDENTITY_CONFLICT')
  }
}

export async function upsertGoogleUser(
  db: D1Database,
  user: { id: string; email: string; google_id: string | null; name: string | null; avatar_url: string | null },
): Promise<UserRow | null> {
  const googleId = user.google_id?.trim()
  if (!googleId) throw new Error('GOOGLE_IDENTITY_MISSING')

  // Google `sub` is the immutable provider identity. Always resolve by subject
  // first, then treat the verified email only as a safe account-linking hint.
  const bySubject = await getUserByGoogleId(db, googleId)
  if (bySubject) return refreshGoogleProfile(db, bySubject.id, user)

  const byEmail = await getUserByEmail(db, user.email)
  if (byEmail) {
    assertGoogleIdentityCanLink(byEmail, googleId)
    await db.prepare(`
      UPDATE users SET
        google_id = ?,
        name = COALESCE(?, name),
        avatar_url = COALESCE(?, avatar_url),
        is_verified = 1,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(googleId, user.name ?? null, user.avatar_url ?? null, byEmail.id).run()
    return getUserById(db, byEmail.id)
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const otyaId = await generateOtyaId(db)
    try {
      await db.prepare(`
        INSERT INTO users (id, otya_id, email, google_id, name, avatar_url, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).bind(
        user.id,
        otyaId,
        user.email,
        googleId,
        user.name ?? null,
        user.avatar_url ?? null,
      ).run()
      return getUserByGoogleId(db, googleId)
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error

      // Resolve races by immutable provider subject first. Only link by email if
      // that account is not already attached to a different Google subject.
      const racedSubject = await getUserByGoogleId(db, googleId)
      if (racedSubject) return refreshGoogleProfile(db, racedSubject.id, user)

      const racedEmail = await getUserByEmail(db, user.email)
      if (racedEmail) {
        assertGoogleIdentityCanLink(racedEmail, googleId)
        await db.prepare(`
          UPDATE users SET
            google_id = ?,
            name = COALESCE(?, name),
            avatar_url = COALESCE(?, avatar_url),
            is_verified = 1,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(googleId, user.name ?? null, user.avatar_url ?? null, racedEmail.id).run()
        return getUserById(db, racedEmail.id)
      }

      if (attempt === 15) throw error
    }
  }
  return null
}

/** Record that a shared OTYA account has used a product. */
export async function touchUserProduct(
  db: D1Database,
  userId: string,
  productId: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO user_products (user_id, product_id)
    VALUES (?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET
      status = 'active',
      last_seen_at = datetime('now')
  `).bind(userId, productId).run()
}

export async function updatePasswordHash(
  db: D1Database,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(passwordHash, userId).run()
}

export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
}
