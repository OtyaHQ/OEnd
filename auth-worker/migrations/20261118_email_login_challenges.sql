-- Passwordless email OTP sign-in challenges.
-- Existing D1 account data is preserved. One row per user holds only the
-- HMAC digest for the current short-lived challenge; the plaintext code is
-- delivered to the current email address and is never stored.

CREATE TABLE IF NOT EXISTS email_login_challenges (
  user_id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL,
  code_digest TEXT NOT NULL
    CHECK (length(code_digest) = 64 AND code_digest NOT GLOB '*[^0-9a-f]*'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','CONSUMED','LOCKED','FAILED','EXPIRED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_login_challenges_expiry
  ON email_login_challenges(status, expires_at);
