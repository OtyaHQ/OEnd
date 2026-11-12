-- O private AI staging baseline.
-- Schema only: legacy Otya Next conversations, memory and task data are not copied.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_owner
  ON ai_conversations(owner_type, owner_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS ai_memory_items (
  id TEXT PRIMARY KEY,
  owner_key_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_owner
  ON ai_memory_items(owner_key_hash, category, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_approvals (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_ref TEXT,
  payload_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','expired','executed')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  executed_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  rejection_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_approvals_status ON ai_approvals(status, expires_at);

CREATE TABLE IF NOT EXISTS ai_task_runs (
  id TEXT PRIMARY KEY,
  agent_role TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  model TEXT,
  input_sha256 TEXT,
  output_sha256 TEXT,
  cost_units INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_status ON ai_task_runs(status, started_at);

CREATE TABLE IF NOT EXISTS ai_tool_events (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  actor_id TEXT,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  policy_result TEXT NOT NULL,
  approval_id TEXT,
  payload_sha256 TEXT,
  result_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_tool_events_run ON ai_tool_events(run_id, created_at);

CREATE TABLE IF NOT EXISTS ai_support_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_email_id TEXT,
  sender_email TEXT,
  subject TEXT,
  action TEXT NOT NULL,
  risk TEXT,
  draft_text TEXT,
  resend_email_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS owner_action_executions (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('executing','completed','failed')),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  failed_at TEXT,
  provider TEXT,
  provider_reference TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS o_ai_schema_migrations (
  version TEXT PRIMARY KEY,
  checksum_sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workspace isolation is explicit even though v1 only enables the private owner workspace.
CREATE TABLE IF NOT EXISTS ai_workspaces (
  id TEXT PRIMARY KEY,
  workspace_type TEXT NOT NULL CHECK(workspace_type IN ('owner','product')),
  product_id TEXT,
  principal_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_type, product_id, principal_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_workspaces_principal
  ON ai_workspaces(principal_id, workspace_type, product_id);
