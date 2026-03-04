-- ============================================================
-- Migration 011: Fix payment_status enum + pending listings RPC
--
-- 1. Adds 'paid' to payment_status enum
--    The Stripe webhook and M-Pesa callback both write
--    payment_status = 'paid', but the original enum only has
--    'completed'. This causes a DB constraint violation on every
--    successful payment, silently preventing order confirmation.
--
-- 2. Fixes get_pending_listings_admin() to exclude drafts
--    Previous filter (is_approved=false AND status!='rejected')
--    included 'draft' listings. Fixed to 'pending_approval' only.
-- ============================================================

-- ── 1. Extend payment_status enum ──────────────────────────
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';

-- ── 2. Fix get_pending_listings_admin() ────────────────────
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
             'image_url',  li.image_url,
             'is_primary', li.is_primary
           ))
            FROM listing_images li WHERE li.listing_id = l.id),
           '[]'::jsonb
         ) AS images,
         jsonb_build_object('name', COALESCE(c.name, 'Uncategorised')) AS category
       FROM listings l
       LEFT JOIN profiles p   ON p.id = l.seller_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.status::text = 'pending_approval'   -- was: is_approved=false AND status!='rejected'
       ORDER BY l.created_at ASC
       LIMIT 100
     ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 3. Rewrite get_all_users_admin() ──────────────────────
-- The original version (004) used a try-catch to handle the
-- missing `town` column before migration 002. Since 002 is now
-- applied, remove the fragile exception-catching pattern so
-- partial failures don't silently return fewer rows than exist.
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

-- Also fix get_admin_stats() pending count to match
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_users       bigint  := 0;
  v_listings    bigint  := 0;
  v_orders      bigint  := 0;
  v_revenue     numeric := 0;
  v_pend_lst    bigint  := 0;
  v_pend_verif  bigint  := 0;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('ceo', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: admin/CEO only';
  END IF;

  SELECT COUNT(*) INTO v_users    FROM profiles;
  SELECT COUNT(*) INTO v_listings FROM listings;
  SELECT COUNT(*) INTO v_orders   FROM orders;

  -- Accept both 'paid' (new) and 'completed' (legacy) as successful payments
  SELECT COALESCE(SUM(total), 0) INTO v_revenue
    FROM orders WHERE payment_status::text IN ('paid', 'completed');

  -- Count only listings explicitly submitted for review
  SELECT COUNT(*) INTO v_pend_lst
    FROM listings WHERE status::text = 'pending_approval';

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
