-- O production annotations are private to the owner assistant.
-- User-submitted feedback and crash reports remain owned by Otya End.
CREATE TABLE IF NOT EXISTS ai_feedback_annotations (
  feedback_id TEXT PRIMARY KEY,
  category TEXT,
  sentiment TEXT,
  flagged INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0,1)),
  suggested_reply TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_annotations_updated
  ON ai_feedback_annotations(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_crash_annotations (
  crash_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  summary TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_crash_annotations_group
  ON ai_crash_annotations(group_id, updated_at DESC);
