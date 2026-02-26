-- ============================================================
-- MAASAI HERITAGE MARKET — FIX ROLE RLS & USER VISIBILITY
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── STEP 1: Non-recursive role helper ─────────────────────
-- SECURITY DEFINER bypasses RLS inside the function, so
-- it can read profiles without triggering infinite recursion.
-- This is safe: it only returns the caller's OWN role.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid()
$$;

-- ── STEP 2: Staff can SELECT all profiles ─────────────────
-- Without this, CEO/Manager can only see their own profile
-- (the default `auth.uid() = id` policy). Supabase uses OR
-- logic across policies, so adding this policy means staff
-- see all rows; other users still only see themselves.
DROP POLICY IF EXISTS "staff_select_all_profiles" ON profiles;
CREATE POLICY "staff_select_all_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (get_my_role() IN ('ceo', 'admin', 'manager'));

-- ── STEP 3: Fix UPDATE policy (also use helper, not EXISTS) ─
-- The original EXISTS subquery can cause recursive RLS.
-- Replace it with the get_my_role() helper.
DROP POLICY IF EXISTS "Staff can update any profile" ON profiles;
CREATE POLICY "Staff can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR get_my_role() IN ('ceo', 'admin', 'manager')
  )
  WITH CHECK (
    auth.uid() = id
    OR get_my_role() IN ('ceo', 'admin', 'manager')
  );

-- ── STEP 4: Secure role-update RPC ────────────────────────
-- SECURITY DEFINER means it runs as the DB owner, fully
-- bypassing RLS. The function enforces its own auth check.
-- This is the ONLY reliable way to update roles from client.
CREATE OR REPLACE FUNCTION update_user_role(
  p_target_user_id  uuid,
  p_new_role        text,
  p_town            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_rows_updated int;
BEGIN
  -- Verify caller is CEO or admin
  SELECT role::text INTO v_caller_role
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF v_caller_role NOT IN ('ceo', 'admin') THEN
    RETURN jsonb_build_object('error', 'Unauthorized: CEO/Admin only');
  END IF;

  -- Validate the role value
  IF p_new_role NOT IN ('buyer', 'seller', 'agent', 'manager', 'ceo', 'admin') THEN
    RETURN jsonb_build_object('error', 'Invalid role: ' || p_new_role);
  END IF;

  -- Perform the update
  UPDATE profiles SET
    role        = p_new_role::user_role,
    -- Only set town when assigning agent; clear it for other roles
    town        = CASE
                    WHEN p_new_role = 'agent' THEN p_town
                    ELSE NULL
                  END,
    assigned_by = auth.uid(),
    updated_at  = now()
  WHERE id = p_target_user_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('error', 'User not found or no change made');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'role',    p_new_role,
    'town',    p_town
  );
END;
$$;

-- Grant execute to authenticated users
-- (the function itself enforces CEO-only inside)
GRANT EXECUTE ON FUNCTION update_user_role(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
