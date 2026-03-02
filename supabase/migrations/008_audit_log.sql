-- ============================================================
-- Migration 008: Audit Log
-- Records key platform actions for compliance and debugging.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,               -- e.g. 'role_changed', 'listing_approved'
  entity_type TEXT,                               -- e.g. 'order', 'listing', 'profile'
  entity_id   TEXT,                               -- UUID or code of the entity
  payload     JSONB       DEFAULT '{}'::jsonb,    -- before/after or context data
  ip          TEXT,                               -- client IP (best-effort)
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_time_idx   ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);

-- RLS: staff (CEO/manager) can read; no direct writes from client
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_audit_log" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'manager')
    )
  );

-- Helper function: insert an audit row (called from server-side only via admin client)
-- Usage: SELECT write_audit_log('actor-uuid', 'listing_approved', 'listing', 'listing-uuid', '{"title":"X"}')
CREATE OR REPLACE FUNCTION write_audit_log(
  p_actor_id    UUID,
  p_action      TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   TEXT DEFAULT NULL,
  p_payload     JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, payload)
  VALUES (p_actor_id, p_action, p_entity_type, p_entity_id, p_payload);
END;
$$;
