-- Email login OTP challenges use D1 for atomic one-time redemption.
-- Only the keyed HMAC digest is stored; never persist the plaintext code.
CREATE TABLE IF NOT EXISTS auth_email_login_challenges (
  user_id TEXT PRIMARY KEY,
  code_digest TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_email_login_challenges_expires
  ON auth_email_login_challenges(expires_at);
