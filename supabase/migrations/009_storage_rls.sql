-- ============================================================
-- Migration 009: Storage RLS
-- Locks down sensitive buckets so only authorised users can
-- read / write files.
-- ============================================================

-- ── listing-images ────────────────────────────────────────
-- Public reads are fine (product images are public).
-- Writes restricted to authenticated sellers (and staff).

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone may read public listing images (bucket is public, no policy needed)
-- Sellers may only upload into their own folder: {seller_id}/{listing_id}/...
DROP POLICY IF EXISTS "sellers_upload_listing_images" ON storage.objects;
CREATE POLICY "sellers_upload_listing_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "sellers_delete_own_listing_images" ON storage.objects;
CREATE POLICY "sellers_delete_own_listing_images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── verification-docs ─────────────────────────────────────
-- Private bucket — seller uploads their own docs,
-- CEO / manager / admin can read any doc.

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Sellers upload into their own folder: {seller_id}/...
DROP POLICY IF EXISTS "sellers_upload_verification_docs" ON storage.objects;
CREATE POLICY "sellers_upload_verification_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own docs
DROP POLICY IF EXISTS "sellers_read_own_verification_docs" ON storage.objects;
CREATE POLICY "sellers_read_own_verification_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff (CEO / manager / admin) can read any verification doc
DROP POLICY IF EXISTS "staff_read_verification_docs" ON storage.objects;
CREATE POLICY "staff_read_verification_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'verification-docs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'manager')
    )
  );

-- Staff may also delete docs (e.g. after verification is complete)
DROP POLICY IF EXISTS "staff_delete_verification_docs" ON storage.objects;
CREATE POLICY "staff_delete_verification_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'verification-docs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ceo', 'admin', 'manager')
    )
  );

-- ── avatars ───────────────────────────────────────────────
-- Public reads, authenticated owners may upload/delete.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "users_upload_own_avatar" ON storage.objects;
CREATE POLICY "users_upload_own_avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects;
CREATE POLICY "users_update_own_avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users_delete_own_avatar" ON storage.objects;
CREATE POLICY "users_delete_own_avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
