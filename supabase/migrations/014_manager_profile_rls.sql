-- ============================================================
-- Migration 014: Allow managers and CEOs to update profiles
-- Fixes: verification approve/reject silently failing for
-- manager role due to missing RLS UPDATE policy on profiles.
-- ============================================================

DROP POLICY IF EXISTS "Staff can update any profile" ON profiles;
CREATE POLICY "Staff can update any profile"
  ON profiles FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'ceo', 'manager')
    )
  );
