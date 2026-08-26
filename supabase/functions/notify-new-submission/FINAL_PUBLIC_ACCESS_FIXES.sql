-- APRILS SIGNATURE — FINAL PUBLIC ACCESS FIXES
-- Run in Supabase SQL Editor once.
-- These policies expose only records intended for the public website.
-- Customer submissions and admin settings remain private.

DO $$
BEGIN
  IF to_regclass('public.gallery_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_gallery_items_read_active" ON public.gallery_items';
    EXECUTE 'CREATE POLICY "public_gallery_items_read_active" ON public.gallery_items FOR SELECT TO anon, authenticated USING (active = true)';
  END IF;

  IF to_regclass('public.gallery_collections') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gallery_collections ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_gallery_collections_read_active" ON public.gallery_collections';
    EXECUTE 'CREATE POLICY "public_gallery_collections_read_active" ON public.gallery_collections FOR SELECT TO anon, authenticated USING (active = true)';
  END IF;

  IF to_regclass('public.training_programs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_training_programs_read_active" ON public.training_programs';
    EXECUTE 'CREATE POLICY "public_training_programs_read_active" ON public.training_programs FOR SELECT TO anon, authenticated USING (active = true)';
  END IF;

  IF to_regclass('public.admin_services') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.admin_services ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_admin_services_read_active" ON public.admin_services';
    EXECUTE 'CREATE POLICY "public_admin_services_read_active" ON public.admin_services FOR SELECT TO anon, authenticated USING (active = true)';
  END IF;

  IF to_regclass('public.public_payment_details') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.public_payment_details ADD COLUMN IF NOT EXISTS bank text';
    EXECUTE 'ALTER TABLE public.public_payment_details ADD COLUMN IF NOT EXISTS branch text';
    EXECUTE 'ALTER TABLE public.public_payment_details ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_payment_details_read_active" ON public.public_payment_details';
    EXECUTE 'CREATE POLICY "public_payment_details_read_active" ON public.public_payment_details FOR SELECT TO anon, authenticated USING (active = true)';
  END IF;

  IF to_regclass('public.settings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_settings_read_safe_content" ON public.settings';
    EXECUTE $policy$
      CREATE POLICY "public_settings_read_safe_content" ON public.settings
      FOR SELECT TO anon, authenticated
      USING (
        setting_key LIKE 'product_%'
        OR setting_key LIKE 'public_training_price_%'
        OR setting_key LIKE 'homepage_featured_%'
      )
    $policy$;
  END IF;

  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_quote_requests_insert" ON public.quote_requests';
    EXECUTE 'CREATE POLICY "public_quote_requests_insert" ON public.quote_requests FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;

  IF to_regclass('public.training_registrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.training_registrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_training_registrations_insert" ON public.training_registrations';
    EXECUTE 'CREATE POLICY "public_training_registrations_insert" ON public.training_registrations FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;

  IF to_regclass('public.enquiries') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "public_enquiries_insert" ON public.enquiries';
    EXECUTE 'CREATE POLICY "public_enquiries_insert" ON public.enquiries FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;
END $$;

-- IMPORTANT:
-- Do NOT create public SELECT policies for quote_requests,
-- training_registrations, enquiries, notifications, or private invoice settings.

-- Customer data must never be publicly readable.
DO $$
BEGIN
  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.quote_requests FROM anon';
  END IF;
  IF to_regclass('public.training_registrations') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.training_registrations FROM anon';
  END IF;
  IF to_regclass('public.enquiries') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.enquiries FROM anon';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.notifications FROM anon';
  END IF;
END $$;
