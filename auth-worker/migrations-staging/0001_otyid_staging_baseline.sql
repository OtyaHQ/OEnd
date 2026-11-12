-- Otya ID isolated staging baseline.
-- Schema only: no accounts, sessions, OTPs, linked identities or recovery data are copied.
-- Captured from the isolated otya-id-staging-db schema on 2026-11-12.
-- Excludes Cloudflare's internal _cf_KV table. Safe to apply to an empty staging database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  otya_id TEXT,
  username TEXT,
  username_changed_at TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  phone_number TEXT,
  phone_verified_at TEXT,
  phone_verification_method TEXT,
  recovery_email TEXT,
  recovery_email_verified_at TEXT,
  country_code TEXT,
  locale TEXT,
  timezone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_two_factor (
  user_id TEXT PRIMARY KEY,
  encrypted_secret TEXT NOT NULL,
  recovery_hashes TEXT NOT NULL DEFAULT '[]',
  enabled_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_otp_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS linked_identities (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_username TEXT,
  provider_email TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_products (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created
  ON auth_security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_created
  ON auth_security_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_otp_email_purpose_created
  ON email_otp_challenges(email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_linked_identities_user
  ON linked_identities(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_user_products_product
  ON user_products(product_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_google
  ON users(google_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_otya_id
  ON users(otya_id)
  WHERE otya_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone_number)
  WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_ci
  ON users(lower(username))
  WHERE username IS NOT NULL;
