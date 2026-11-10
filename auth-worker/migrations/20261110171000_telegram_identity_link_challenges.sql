-- Store only the HMAC OTP digest and a SHA-256 hash of the verified email.
-- The challenge is consumed by a conditional DELETE ... RETURNING.
CREATE TABLE IF NOT EXISTS telegram_identity_link_challenges (
  user_id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  otp_digest TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telegram_identity_link_challenges_expiry
  ON telegram_identity_link_challenges(expires_at);
