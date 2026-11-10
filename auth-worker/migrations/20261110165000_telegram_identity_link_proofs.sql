-- One active, short-lived owner Telegram identity link proof per Otya user.
-- The current verified email is represented only by a SHA-256 digest.
-- Consumption uses DELETE ... RETURNING for an atomic one-use claim.
CREATE TABLE IF NOT EXISTS telegram_identity_link_proofs (
  user_id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telegram_identity_link_proofs_expiry
  ON telegram_identity_link_proofs(expires_at);
