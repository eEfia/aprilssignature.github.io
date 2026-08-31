-- APRILS SIGNATURE — FINAL PUBLIC ACCESS FIXES
-- Run in Supabase SQL Editor once.
-- These policies expose only records intended for the lic webse.
-- Customer submissions and admin settings remain pte.

DO $$
BEGIN
  IF to_regclass('public.gallery_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gallery_items ENABLE ROW LEVECURITY
    EXECUTE 'DROP POLICY IF EXISTS "public_gallery_items_read_active" ON public.gallery_items';
    EXECUTE 'CREATE POLICY "public_gallery_items_read_active" Opublic.gallery_items FOR SELECT TO anon, authenticated USING (active = true)';
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

-- ================================================================
-- APRILS SIGNATURE — PUBLIC CONTACT / PAYMENT / NOTIFICATION HARDENING
-- Safe to run after the section above.
-- ================================================================

DO $$
BEGIN
  -- Public contact information is intentionally limited to business contact fields.
  IF to_regclass('public.contact_settings') IS NOT NULL THEN
    ALTER TABLE public.contact_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "public_contact_settings_read" ON public.contact_settings;
    CREATE POLICY "public_contact_settings_read"
      ON public.contact_settings FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Public payment details are a deliberately separate, non-sensitive table.
  IF to_regclass('public.public_payment_details') IS NULL THEN
    CREATE TABLE public.public_payment_details (
      id bigint generated by default as identity primary key,
      network text,
      number text,
      name text,
      bank text,
      branch text,
      active boolean not null default true,
      display_order integer not null default 1,
      updated_at timestamptz not null default now()
    );
  END IF;

  ALTER TABLE public.public_payment_details ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "public_payment_details_read_active" ON public.public_payment_details;
  CREATE POLICY "public_payment_details_read_active"
    ON public.public_payment_details FOR SELECT TO anon, authenticated USING (active = true);

  -- Only the authenticated Admin client should write payment details.
  REVOKE INSERT, UPDATE, DELETE ON public.public_payment_details FROM anon;

  -- Notifications are private. The trigger below creates them from a public
  -- submission without exposing customer records through a public SELECT policy.
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    REVOKE SELECT ON public.notifications FROM anon;
  END IF;
END $$;

-- Create a notification row whenever a public submission is accepted.
-- The Edge Function reads this row using the service-role key and sends the
-- configured email / WhatsApp Business notification.
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.aprils_create_submission_notification()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        payload jsonb := to_jsonb(NEW);
      BEGIN
        INSERT INTO public.notifications
          (event_type, source_table, source_id, customer_name, phone, whatsapp, email, details, status)
        VALUES
          (TG_TABLE_NAME || '_new_submission', TG_TABLE_NAME, NEW.id,
           COALESCE(payload->>'full_name', payload->>'name', 'Customer'),
           COALESCE(payload->>'phone', ''), COALESCE(payload->>'whatsapp', ''), COALESCE(payload->>'email', ''),
           payload, 'pending');
        RETURN NEW;
      EXCEPTION WHEN undefined_column OR undefined_table OR undefined_object THEN
        RETURN NEW;
      END;
      $body$;
    $fn$;

    IF to_regclass('public.quote_requests') IS NOT NULL THEN
      DROP TRIGGER IF EXISTS aprils_quote_submission_notification ON public.quote_requests;
      CREATE TRIGGER aprils_quote_submission_notification
        AFTER INSERT ON public.quote_requests
        FOR EACH ROW EXECUTE FUNCTION public.aprils_create_submission_notification();
    END IF;

    IF to_regclass('public.training_registrations') IS NOT NULL THEN
      DROP TRIGGER IF EXISTS aprils_training_submission_notification ON public.training_registrations;
      CREATE TRIGGER aprils_training_submission_notification
        AFTER INSERT ON public.training_registrations
        FOR EACH ROW EXECUTE FUNCTION public.aprils_create_submission_notification();
    END IF;

    IF to_regclass('public.enquiries') IS NOT NULL THEN
      DROP TRIGGER IF EXISTS aprils_enquiry_submission_notification ON public.enquiries;
      CREATE TRIGGER aprils_enquiry_submission_notification
        AFTER INSERT ON public.enquiries
        FOR EACH ROW EXECUTE FUNCTION public.aprils_create_submission_notification();
    END IF;
  END IF;
END $$;
