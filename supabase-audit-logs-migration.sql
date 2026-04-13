-- Audit log table for user activity tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  user_id      UUID,
  user_email   TEXT,
  user_name    TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  entity_label TEXT,
  details      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Authenticated users can view audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can view audit logs"
      ON audit_logs FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Authenticated users can insert audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert audit logs"
      ON audit_logs FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_email_idx ON audit_logs (user_email);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON audit_logs (entity_type);
