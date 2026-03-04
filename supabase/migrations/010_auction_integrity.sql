-- ============================================================
-- Migration 010: Auction Integrity
-- • place_bid() RPC  — row-locked, atomic bid placement
-- • end_expired_auctions() — marks expired auctions as sold/ended
-- • pg_cron schedule — runs end_expired_auctions every 5 minutes
-- ============================================================

-- ── place_bid() ───────────────────────────────────────────
-- Called from the server-side bid API route via adminClient.rpc()
-- Returns: { bid_id, new_current_bid, bid_count }
-- Raises exceptions on validation failures (caught by the caller)

CREATE OR REPLACE FUNCTION place_bid(
  p_listing_id UUID,
  p_bidder_id  UUID,
  p_amount     NUMERIC
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing     listings%ROWTYPE;
  v_current_bid NUMERIC;
  v_min_bid     NUMERIC;
  v_new_bid     bids%ROWTYPE;
BEGIN
  -- Lock the listing row to prevent race conditions
  SELECT * INTO v_listing
  FROM listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  IF v_listing.listing_type <> 'auction' THEN
    RAISE EXCEPTION 'not_an_auction';
  END IF;

  IF v_listing.status <> 'active' OR NOT v_listing.is_approved THEN
    RAISE EXCEPTION 'auction_not_active';
  END IF;

  IF v_listing.auction_end_time IS NOT NULL AND v_listing.auction_end_time <= now() THEN
    RAISE EXCEPTION 'auction_ended';
  END IF;

  IF v_listing.seller_id = p_bidder_id THEN
    RAISE EXCEPTION 'cannot_bid_own_listing';
  END IF;

  v_current_bid := COALESCE(v_listing.current_bid, v_listing.price, 0);
  v_min_bid     := v_current_bid + 100;

  IF p_amount < v_min_bid THEN
    RAISE EXCEPTION 'bid_too_low:% ', v_min_bid;
  END IF;

  -- Demote previous winning bid
  UPDATE bids SET is_winning = false
  WHERE listing_id = p_listing_id AND is_winning = true;

  -- Insert new winning bid
  INSERT INTO bids (listing_id, bidder_id, amount, is_winning)
  VALUES (p_listing_id, p_bidder_id, p_amount, true)
  RETURNING * INTO v_new_bid;

  -- Update listing aggregate
  UPDATE listings
  SET current_bid = p_amount,
      bid_count   = COALESCE(bid_count, 0) + 1
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'bid_id',          v_new_bid.id,
    'new_current_bid', p_amount,
    'bid_count',       COALESCE(v_listing.bid_count, 0) + 1
  );
END;
$$;

-- ── end_expired_auctions() ────────────────────────────────
-- Marks expired auctions as 'sold' (if there is a winning bid)
-- or 'ended' (if no bids were placed).

-- DROP first so we can change the return type if it existed as VOID
DROP FUNCTION IF EXISTS end_expired_auctions();

CREATE OR REPLACE FUNCTION end_expired_auctions() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec   RECORD;
BEGIN
  FOR v_rec IN
    SELECT l.id, b.bidder_id, b.amount
    FROM listings l
    LEFT JOIN bids b ON b.listing_id = l.id AND b.is_winning = true
    WHERE l.listing_type     = 'auction'
      AND l.status           = 'active'
      AND l.auction_end_time <= now()
  LOOP
    IF v_rec.bidder_id IS NOT NULL THEN
      -- Has a winner — mark sold and create an order stub
      UPDATE listings
      SET status = 'sold', sold_at = now()
      WHERE id = v_rec.id;
    ELSE
      -- No bids — mark as ended (available for re-listing)
      UPDATE listings
      SET status = 'ended'
      WHERE id = v_rec.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── pg_cron schedule ─────────────────────────────────────
-- Requires the pg_cron extension (enabled in Supabase dashboard
-- under Database → Extensions → pg_cron).
-- Run every 5 minutes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'end-expired-auctions',          -- job name (idempotent)
      '*/5 * * * *',                   -- every 5 minutes
      'SELECT end_expired_auctions()'
    );
  END IF;
END;
$$;
