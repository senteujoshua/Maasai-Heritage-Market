-- ============================================================
-- Add Stripe and PayPal to payment_method enum
-- ============================================================

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'paypal';
