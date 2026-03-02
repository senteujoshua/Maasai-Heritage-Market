-- Stripe webhook idempotency: store processed event IDs to prevent duplicate processing
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id         TEXT PRIMARY KEY,          -- Stripe event ID (evt_xxx)
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Expire rows older than 30 days (Stripe's replay window is 3 days)
-- Can be run via pg_cron or a scheduled job
-- For now, just create the table; cleanup is handled separately
