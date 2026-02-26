-- ============================================================
-- MAASAI HERITAGE MARKET — ADMIN SECURITY DEFINER RPCs
-- Run AFTER 003_fix_role_rls.sql
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- WHY THIS FILE EXISTS
-- Direct table queries from the admin page fail silently when
-- RLS blocks them (returns error:null, data:null → shows zeros).
-- SECURITY DEFINER functions run as the DB owner, bypass RLS
-- entirely, and enforce their own CEO/admin auth check inside.
-- They also fix two DB schema bugs the frontend code assumed:
--   • orders has no listing_id FK  (items is a jsonb array)
--   • orders column is 'status'    (not 'order_status')
--   • payment_status enum is 'completed' (not 'paid')
-- ============================================================

-- ── 1. Platform stats ──────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_users       bigint := 0;
  v_listings    bigint := 0;
  v_orders      bigint := 0;
  v_revenue     numeric := 0;
  v_pend_lst    bigint := 0;
  v_pend_verif  bigint := 0;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: admin/CEO only';
  END IF;

  SELECT COUNT(*) INTO v_users     FROM profiles;
  SELECT COUNT(*) INTO v_listings  FROM listings;
  SELECT COUNT(*) INTO v_orders    FROM orders;

  -- Initial schema uses 'completed'; some code also sends 'paid' — handle both
  SELECT COALESCE(SUM(total), 0) INTO v_revenue
    FROM orders WHERE payment_status::text IN ('paid', 'completed');

  SELECT COUNT(*) INTO v_pend_lst
    FROM listings WHERE is_approved = false AND status::text != 'rejected';

  SELECT COUNT(*) INTO v_pend_verif
    FROM profiles
    WHERE verification_status::text = 'pending' AND role::text = 'seller';

  RETURN jsonb_build_object(
    'totalUsers',           v_users,
    'totalListings',        v_listings,
    'totalOrders',          v_orders,
    'totalRevenue',         v_revenue,
    'pendingListings',      v_pend_lst,
    'pendingVerifications', v_pend_verif,
    'platformEarnings',     ROUND(v_revenue * 0.09, 2)
  );
END;
$$;

-- ── 2. Pending listings ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pending_listings_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(r ORDER BY r.created_at ASC)
     FROM (
       SELECT
         l.id,
         l.title,
         l.price,
         l.listing_type::text  AS listing_type,
         l.created_at,
         jsonb_build_object(
           'full_name',   p.full_name,
           'shop_name',   p.shop_name,
           'is_verified', p.is_verified
         ) AS seller,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object(
             'image_url', li.image_url,
             'is_primary', li.is_primary
           ))
            FROM listing_images li WHERE li.listing_id = l.id),
           '[]'::jsonb
         ) AS images,
         jsonb_build_object('name', COALESCE(c.name, 'Uncategorised')) AS category
       FROM listings l
       LEFT JOIN profiles p    ON p.id = l.seller_id
       LEFT JOIN categories c  ON c.id = l.category_id
       WHERE l.is_approved = false AND l.status::text != 'rejected'
       ORDER BY l.created_at ASC
       LIMIT 100
     ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 3. Pending seller verifications ───────────────────────
CREATE OR REPLACE FUNCTION get_pending_verifications_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(r ORDER BY r.created_at ASC)
     FROM (
       SELECT id, full_name, email, phone,
              national_id_url, kra_pin_url, created_at, shop_name
       FROM profiles
       WHERE verification_status::text = 'pending'
         AND role::text = 'seller'
       ORDER BY created_at ASC
       LIMIT 100
     ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 4. All orders (fixes listing join + column name) ──────
-- Orders table has no listing_id FK — items is a jsonb array.
-- DB column is 'status', not 'order_status'. Aliased here.
CREATE OR REPLACE FUNCTION get_all_orders_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(r ORDER BY r.created_at DESC)
     FROM (
       SELECT
         o.id,
         o.total,
         o.payment_status::text  AS payment_status,
         o.status::text          AS order_status,      -- aliased for frontend
         o.created_at,
         o.payment_method::text  AS payment_method,
         jsonb_build_object('full_name', p.full_name, 'email', p.email) AS buyer,
         -- Extract first item title from jsonb array
         CASE
           WHEN o.items IS NOT NULL AND jsonb_array_length(o.items) > 0
           THEN jsonb_build_object('title', o.items -> 0 ->> 'title')
           ELSE jsonb_build_object('title', NULL)
         END AS listing
       FROM orders o
       LEFT JOIN profiles p ON p.id = o.buyer_id
       ORDER BY o.created_at DESC
       LIMIT 200
     ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 5. All users ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(r ORDER BY r.created_at DESC)
     FROM (
       SELECT
         id,
         full_name,
         email,
         role::text                   AS role,
         is_verified,
         verification_status::text    AS verification_status,
         created_at,
         COALESCE(total_sales, 0)     AS total_sales,
         COALESCE(rating, 0)          AS rating,
         shop_name,
         town
       FROM profiles
       ORDER BY created_at DESC
       LIMIT 500
     ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── Grant execute to authenticated users ───────────────────
-- (Each function enforces CEO/admin check inside — safe to expose)
GRANT EXECUTE ON FUNCTION get_admin_stats()                 TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_listings_admin()      TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_verifications_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_orders_admin()            TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_admin()             TO authenticated;
