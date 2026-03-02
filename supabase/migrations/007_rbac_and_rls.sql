-- ============================================================
-- MAASAI HERITAGE MARKET — RBAC + RLS HARDENING
-- Phase 2: JWT role sync | Phase 3: Tighter RLS policies
-- ============================================================

-- ── PHASE 2: Sync profile.role → JWT app_metadata ────────────────────────────
-- When a profile's role changes, mirror it into auth.users.raw_app_meta_data
-- so middleware can read the role from the JWT without a DB round-trip.

CREATE OR REPLACE FUNCTION sync_role_to_jwt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', NEW.role::text)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_to_jwt ON profiles;
CREATE TRIGGER trg_sync_role_to_jwt
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_role_to_jwt();

-- Also sync on INSERT (new profile creation)
CREATE OR REPLACE FUNCTION sync_role_to_jwt_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_to_jwt_insert ON profiles;
CREATE TRIGGER trg_sync_role_to_jwt_insert
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_role_to_jwt_on_insert();

-- Backfill existing users (run once)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', r.role::text)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── PHASE 3: RLS — Tighten platform_settings SELECT ─────────────────────────
-- Currently managers can read platform_settings; restrict to CEO/admin only.

DROP POLICY IF EXISTS "Staff can view platform settings" ON platform_settings;
CREATE POLICY "CEO and admin can view platform settings"
  ON platform_settings FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo'))
  );

-- ── PHASE 3: RLS — Bids ──────────────────────────────────────────────────────
-- Drop permissive existing policies if any, add constrained INSERT policy

ALTER TABLE IF EXISTS bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bids" ON bids;
CREATE POLICY "Anyone can view bids on active listings"
  ON bids FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id AND (
        (status = 'active' AND is_approved = true)
        OR seller_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can place bids" ON bids;
CREATE POLICY "Authenticated users can place bids on active auctions"
  ON bids FOR INSERT WITH CHECK (
    auth.uid() = bidder_id
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_id
        AND listing_type = 'auction'
        AND status = 'active'
        AND is_approved = true
        AND (auction_end_time IS NULL OR auction_end_time > now())
    )
  );

-- ── PHASE 3: RLS — Reviews ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Buyers can submit reviews" ON reviews;
CREATE POLICY "Buyers can review after delivery"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE id = reviews.order_id
        AND buyer_id = auth.uid()
        AND status = 'delivered'
    )
  );

-- ── PHASE 4: Performance indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS listings_status_approved_idx
  ON listings(status, is_approved)
  WHERE status = 'active' AND is_approved = true;

CREATE INDEX IF NOT EXISTS listings_seller_id_idx
  ON listings(seller_id);

CREATE INDEX IF NOT EXISTS listings_category_id_idx
  ON listings(category_id);

CREATE INDEX IF NOT EXISTS listings_created_at_idx
  ON listings(created_at DESC);

CREATE INDEX IF NOT EXISTS listings_auction_end_idx
  ON listings(auction_end_time)
  WHERE listing_type = 'auction' AND status = 'active';

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx
  ON orders(buyer_id);

CREATE INDEX IF NOT EXISTS orders_status_idx
  ON orders(status);

CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON orders(payment_status);

CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS bids_listing_id_idx
  ON bids(listing_id);

CREATE INDEX IF NOT EXISTS bids_amount_idx
  ON bids(listing_id, amount DESC);
