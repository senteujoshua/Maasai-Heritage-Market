-- ============================================================
-- 012: Promote senteujoshua@gmail.com admin → ceo
--      + Fix update_user_role to not depend on migration-002 columns
-- ============================================================

-- 1. Direct promotion (works even if migration-002 columns are absent)
UPDATE profiles
SET role = 'ceo'
WHERE email = 'senteujoshua@gmail.com'
  AND role  = 'admin';

-- 2. Replace update_user_role with a version that degrades gracefully
--    when migration-002 columns (assigned_by, town) don't exist yet.
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
  -- Only CEO or admin may call this
  SELECT role::text INTO v_caller_role
    FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF v_caller_role NOT IN ('ceo', 'admin') THEN
    RETURN jsonb_build_object('error', 'Unauthorized: CEO/Admin only');
  END IF;

  IF p_new_role NOT IN ('buyer', 'seller', 'agent', 'manager', 'ceo', 'admin') THEN
    RETURN jsonb_build_object('error', 'Invalid role: ' || p_new_role);
  END IF;

  -- Primary path: migration-002 columns exist (town, assigned_by)
  BEGIN
    UPDATE profiles SET
      role        = p_new_role::user_role,
      town        = CASE WHEN p_new_role = 'agent' THEN p_town ELSE NULL END,
      assigned_by = auth.uid(),
      updated_at  = now()
    WHERE id = p_target_user_id;
  EXCEPTION WHEN undefined_column THEN
    -- Fallback: migration-002 not applied; update only the columns that exist
    UPDATE profiles SET
      role       = p_new_role::user_role,
      updated_at = now()
    WHERE id = p_target_user_id;
  END;

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

GRANT EXECUTE ON FUNCTION update_user_role(uuid, text, text) TO authenticated;
