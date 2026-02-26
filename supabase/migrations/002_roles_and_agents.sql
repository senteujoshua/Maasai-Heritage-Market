-- ============================================================
-- MAASAI HERITAGE MARKET — ROLES & AGENTS MIGRATION
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ============================================================
-- STEP 1: EXTEND user_role ENUM
-- Postgres requires each ADD VALUE in a separate transaction
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ceo';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';

-- ============================================================
-- STEP 2: ADD NEW COLUMNS TO PROFILES
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS town          text,           -- Agent's assigned town (e.g. 'Nairobi', 'Narok')
  ADD COLUMN IF NOT EXISTS assigned_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- Who assigned this role
  ADD COLUMN IF NOT EXISTS role_notes    text;           -- Internal notes (e.g. agent territory details)

CREATE INDEX IF NOT EXISTS profiles_town_idx ON profiles(town) WHERE town IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- ============================================================
-- STEP 3: ADD NEW COLUMNS TO ORDERS
-- ============================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_code      text UNIQUE,       -- Barcode/QR value on packing slip
  ADD COLUMN IF NOT EXISTS town               text,              -- Delivery town (for agent filtering)
  ADD COLUMN IF NOT EXISTS assigned_agent_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_notes        text,              -- Agent field notes
  ADD COLUMN IF NOT EXISTS scanned_at         timestamptz,       -- When barcode was first scanned
  ADD COLUMN IF NOT EXISTS picked_up_at       timestamptz,       -- When agent picked up from seller
  ADD COLUMN IF NOT EXISTS in_transit_at      timestamptz,       -- When agent marked in transit
  ADD COLUMN IF NOT EXISTS cash_confirmed_at  timestamptz;       -- For COD: when cash received confirmed

CREATE INDEX IF NOT EXISTS orders_tracking_code_idx    ON orders(tracking_code) WHERE tracking_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_assigned_agent_idx   ON orders(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_town_idx             ON orders(town) WHERE town IS NOT NULL;

-- Auto-generate tracking code on order creation (if not provided)
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := 'MHM-' || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_tracking_code ON orders;
CREATE TRIGGER orders_tracking_code
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE PROCEDURE generate_tracking_code();

-- ============================================================
-- STEP 4: PLATFORM SETTINGS TABLE (CEO-controlled)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid REFERENCES profiles(id),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view platform settings"
  ON platform_settings FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );
CREATE POLICY "Only CEO/admin can modify platform settings"
  ON platform_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo'))
  );

-- Seed default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_rate',             '0.09', 'Platform commission percentage (9%)'),
  ('delivery_fee_base',           '350',  'Base delivery fee in KES'),
  ('auction_min_duration_hours',  '6',    'Minimum auction duration in hours'),
  ('auction_max_duration_hours',  '12',   'Maximum auction duration in hours'),
  ('max_listing_images',          '5',    'Maximum images per listing'),
  ('seller_verification_required','true', 'Require seller verification before listing')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 5: DISPUTES TABLE (Manager-handled)
-- ============================================================
CREATE TABLE IF NOT EXISTS disputes (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id    text REFERENCES orders(id) NOT NULL,
  raised_by   uuid REFERENCES profiles(id) NOT NULL,
  assigned_to uuid REFERENCES profiles(id),
  reason      text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disputes_order_id_idx    ON disputes(order_id);
CREATE INDEX IF NOT EXISTS disputes_raised_by_idx   ON disputes(raised_by);
CREATE INDEX IF NOT EXISTS disputes_assigned_to_idx ON disputes(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS disputes_status_idx      ON disputes(status);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disputes"
  ON disputes FOR SELECT USING (
    auth.uid() = raised_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );
CREATE POLICY "Authenticated users can create disputes"
  ON disputes FOR INSERT WITH CHECK (auth.uid() = raised_by);
CREATE POLICY "Staff can update disputes"
  ON disputes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
-- STEP 6: UPDATE EXISTING RLS POLICIES FOR NEW ROLES
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────
-- Drop old admin-only policy, replace with staff policy
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Staff can update any profile"
  ON profiles FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager')
    )
  );

-- ── CATEGORIES ────────────────────────────────────────────
DROP POLICY IF EXISTS "Only admins can modify categories" ON categories;
CREATE POLICY "Only staff can modify categories"
  ON categories FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );

-- ── LISTINGS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Active approved listings viewable by everyone" ON listings;
CREATE POLICY "Active approved listings viewable by everyone"
  ON listings FOR SELECT USING (
    (status = 'active' AND is_approved = true)
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager', 'agent'))
  );

DROP POLICY IF EXISTS "Sellers can update their own listings" ON listings;
CREATE POLICY "Sellers and staff can update listings"
  ON listings FOR UPDATE USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );

DROP POLICY IF EXISTS "Sellers can delete their own listings" ON listings;
CREATE POLICY "Sellers and staff can delete listings"
  ON listings FOR DELETE USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );

-- ── LISTING IMAGES ────────────────────────────────────────
DROP POLICY IF EXISTS "Sellers can manage their listing images" ON listing_images;
CREATE POLICY "Sellers and staff can manage listing images"
  ON listing_images FOR ALL USING (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
  );

-- ── ORDERS ────────────────────────────────────────────────
-- Agents see only orders in their assigned town
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
    OR (
      -- Agent can see orders in their town
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'agent'
      AND town = (SELECT town FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Orders can be updated by buyer or admin" ON orders;
CREATE POLICY "Orders can be updated by buyer, agent or staff"
  ON orders FOR UPDATE USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
    OR (
      -- Agent can update only orders assigned to them in their town
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'agent'
      AND town = (SELECT town FROM profiles WHERE id = auth.uid())
      AND assigned_agent_id = auth.uid()
    )
  );

-- ── STORAGE (verification docs) ───────────────────────────
DROP POLICY IF EXISTS "Admins and owners can view verification docs" ON storage.objects;
CREATE POLICY "Staff and owners can view verification docs"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
    )
  );

-- Create storage bucket for agent issue photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('agent-photos', 'agent-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agents can upload issue photos"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'agent-photos' AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'agent')
  );
CREATE POLICY "Staff and agents can view agent photos"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'agent-photos' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo', 'manager'))
    )
  );

-- ============================================================
-- STEP 7: REALTIME — enable orders table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE disputes;

-- ============================================================
-- STEP 8: USEFUL DATABASE FUNCTIONS
-- ============================================================

-- Function for manager to assign an agent to an order
CREATE OR REPLACE FUNCTION assign_agent_to_order(
  p_order_id text,
  p_agent_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role user_role;
  v_agent_role  user_role;
  v_agent_town  text;
BEGIN
  -- Verify caller is staff
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'ceo', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only staff can assign agents';
  END IF;

  -- Verify assignee is an agent
  SELECT role, town INTO v_agent_role, v_agent_town FROM profiles WHERE id = p_agent_id;
  IF v_agent_role != 'agent' THEN
    RAISE EXCEPTION 'Target user is not an agent';
  END IF;

  -- Update order
  UPDATE orders
  SET
    assigned_agent_id = p_agent_id,
    town = v_agent_town,
    updated_at = now()
  WHERE id = p_order_id;

  -- Notify the agent
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    p_agent_id,
    'order_assigned',
    'New Order Assigned',
    'You have been assigned a new delivery order.',
    jsonb_build_object('order_id', p_order_id)
  );
END;
$$;

-- Function for agent to scan and update order status
CREATE OR REPLACE FUNCTION scan_order(
  p_tracking_code text,
  p_new_status    text,
  p_notes         text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_agent_role user_role;
  v_agent_town text;
  v_order      record;
BEGIN
  -- Verify caller is an agent
  SELECT role, town INTO v_agent_role, v_agent_town FROM profiles WHERE id = auth.uid();
  IF v_agent_role != 'agent' THEN
    RAISE EXCEPTION 'Unauthorized: Only agents can scan orders';
  END IF;

  -- Find the order
  SELECT * INTO v_order FROM orders WHERE tracking_code = p_tracking_code;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found for this tracking code');
  END IF;

  -- Verify agent is assigned to this order or it's in their town
  IF v_order.town != v_agent_town THEN
    RETURN json_build_object('success', false, 'error', 'This order is not in your assigned town');
  END IF;

  -- Update order based on new status
  UPDATE orders SET
    status          = p_new_status::order_status,
    agent_notes     = COALESCE(p_notes, agent_notes),
    scanned_at      = COALESCE(scanned_at, now()),
    picked_up_at    = CASE WHEN p_new_status = 'processing' THEN now() ELSE picked_up_at END,
    in_transit_at   = CASE WHEN p_new_status = 'shipped'    THEN now() ELSE in_transit_at END,
    delivered_at    = CASE WHEN p_new_status = 'delivered'  THEN now() ELSE delivered_at END,
    assigned_agent_id = COALESCE(assigned_agent_id, auth.uid()),
    updated_at      = now()
  WHERE tracking_code = p_tracking_code;

  -- Notify buyer of status change
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_order.buyer_id,
    'order_' || p_new_status,
    CASE p_new_status
      WHEN 'processing' THEN 'Order Picked Up'
      WHEN 'shipped'    THEN 'Order In Transit'
      WHEN 'delivered'  THEN 'Order Delivered!'
      ELSE 'Order Updated'
    END,
    CASE p_new_status
      WHEN 'processing' THEN 'Your order has been picked up and is being prepared for delivery.'
      WHEN 'shipped'    THEN 'Your order is on the way!'
      WHEN 'delivered'  THEN 'Your order has been delivered. Thank you!'
      ELSE 'Your order status has been updated.'
    END,
    jsonb_build_object('order_id', v_order.id, 'status', p_new_status)
  );

  RETURN json_build_object('success', true, 'order_id', v_order.id, 'new_status', p_new_status);
END;
$$;
