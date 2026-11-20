-- Otya Store — D1 Database Schema
-- Run via: wrangler d1 execute otya-store-db --file=schema.sql
-- Or paste into: Cloudflare Dashboard → D1 → otya-store-db → Console

-- Downloads analytics
CREATE TABLE IF NOT EXISTS downloads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  abi        TEXT    NOT NULL,
  version    TEXT,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT    DEFAULT (datetime('now'))
);

-- Release history (used by /check-update and /latest)
-- Seed the current release after running this schema:
--   INSERT OR REPLACE INTO releases
--     (tag, version, version_code, date, changelog, force_update, download_url, arm64_url, arm32_url)
--   VALUES
--     ('v1.4.0','1.4.0',7,'2026-07-23','Bug fixes and performance improvements.',0,
--      'https://otya.site/download/otya-player',
--      'https://otya.site/apk/arm64',
--      'https://otya.site/apk/arm32');
CREATE TABLE IF NOT EXISTS releases (
  tag          TEXT    PRIMARY KEY,
  version      TEXT    NOT NULL,
  version_code INTEGER NOT NULL,
  date         TEXT,
  changelog    TEXT,
  force_update INTEGER DEFAULT 0,
  download_url TEXT,
  arm64_url    TEXT,
  arm32_url    TEXT,
  min_sdk      INTEGER DEFAULT 21,
  target_sdk   INTEGER DEFAULT 36,
  released_at  TEXT    DEFAULT (datetime('now'))
);

-- Devices + FCM tokens
CREATE TABLE IF NOT EXISTS devices (
  device_id     TEXT PRIMARY KEY,
  user_id       TEXT,
  fcm_token     TEXT,
  app_version   TEXT,
  version_code  INTEGER,
  abi           TEXT,
  platform      TEXT DEFAULT 'android',
  registered_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_fcm  ON devices(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id)   WHERE user_id   IS NOT NULL;

-- Playlists (replaces Appwrite playlists collection)
CREATE TABLE IF NOT EXISTS playlists (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  media_ids  TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);

-- Play history (replaces Appwrite play_history collection)
CREATE TABLE IF NOT EXISTS play_history (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  title          TEXT,
  artist         TEXT,
  file_path      TEXT NOT NULL,
  is_video       INTEGER DEFAULT 0,
  last_played_at TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_user   ON play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_played ON play_history(last_played_at DESC);

-- Pro status (replaces Appwrite pro_status collection)
CREATE TABLE IF NOT EXISTS pro_status (
  user_id    TEXT PRIMARY KEY,
  expiry_ms  INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Ratings (star ratings submitted from the app)
CREATE TABLE IF NOT EXISTS ratings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT,
  app_version  TEXT,
  version_code INTEGER,
  stars        INTEGER NOT NULL,
  comment      TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Feedback / problem reports submitted from the app
CREATE TABLE IF NOT EXISTS feedback (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id    TEXT,
  app_version  TEXT,
  version_code INTEGER,
  category     TEXT,
  description  TEXT NOT NULL,
  user_email   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_created  ON ratings(created_at DESC);
