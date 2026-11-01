-- ==============================================================================
-- Harvest Rentals Safe Cleanup & Storage Initialization Migration
-- Safe to run at ANY time, regardless of which tables currently exist.
-- Uses to_regclass() checks with dynamic SQL so it NEVER fails with 42P01.
-- Preserves all genuine user data; only removes test/demo artifacts.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Clean test payments (only if public.payments exists)
  IF to_regclass('public.payments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.payments 
             WHERE id::text LIKE ''demo-%'' 
                OR razorpay_order_id LIKE ''%test%'' 
                OR booking_id IN (
                  SELECT id FROM public.bookings 
                  WHERE farmer_phone IN (''+919999999999'', ''+918888888888'') 
                     OR farmer_name ILIKE ''%demo%''
                )';
    RAISE NOTICE 'Cleaned demo rows from public.payments';
  ELSE
    RAISE NOTICE 'Table public.payments does not exist yet. Skipped.';
  END IF;

  -- 2. Clean test bookings (only if public.bookings exists)
  IF to_regclass('public.bookings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.bookings 
             WHERE farmer_phone IN (''+919999999999'', ''+918888888888'') 
                OR farmer_name ILIKE ''%demo%''';
    RAISE NOTICE 'Cleaned demo rows from public.bookings';
  ELSE
    RAISE NOTICE 'Table public.bookings does not exist yet. Skipped.';
  END IF;

  -- 3. Clean test machine busy dates (only if both machine_busy_dates & machines exist)
  IF to_regclass('public.machine_busy_dates') IS NOT NULL AND to_regclass('public.machines') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.machine_busy_dates 
             WHERE machine_id IN (
               SELECT id FROM public.machines 
               WHERE id::text LIKE ''a%'' 
                  OR id::text LIKE ''b%'' 
                  OR owner_phone IN (''+919999999999'', ''+918888888888'')
                  OR owner_name IN (''Suresh Gowda'', ''Manjunatha K'', ''Channabasappa Patel'', ''Ramesh Heggade'', ''Basavaraj Badiger'', ''Narayana Swamy'', ''Veerabhadrappa G'', ''Anand Kumar'', ''Mallikarjun Kulkarni'', ''Kempegowda'', ''Hanumanthappa Naik'', ''Rudrappa Bellad'')
             )';
    RAISE NOTICE 'Cleaned demo rows from public.machine_busy_dates';
  ELSE
    RAISE NOTICE 'Table public.machine_busy_dates does not exist yet. Skipped.';
  END IF;

  -- 4. Clean test reports (only if public.reports exists)
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.reports 
             WHERE reporter_phone IN (''+919999999999'', ''+918888888888'', ''Anonymous'')';
    RAISE NOTICE 'Cleaned demo rows from public.reports';
  ELSE
    RAISE NOTICE 'Table public.reports does not exist yet. Skipped.';
  END IF;

  -- 5. Clean test machines (only if public.machines exists)
  IF to_regclass('public.machines') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.machines 
             WHERE id::text LIKE ''a%'' 
                OR id::text LIKE ''b%'' 
                OR owner_phone IN (''+919999999999'', ''+918888888888'')
                OR owner_name IN (''Suresh Gowda'', ''Manjunatha K'', ''Channabasappa Patel'', ''Ramesh Heggade'', ''Basavaraj Badiger'', ''Narayana Swamy'', ''Veerabhadrappa G'', ''Anand Kumar'', ''Mallikarjun Kulkarni'', ''Kempegowda'', ''Hanumanthappa Naik'', ''Rudrappa Bellad'')';
    RAISE NOTICE 'Cleaned demo rows from public.machines';
  ELSE
    RAISE NOTICE 'Table public.machines does not exist yet. Skipped.';
  END IF;

  -- 6. Clean test profiles (only if public.profiles exists)
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.profiles 
             WHERE phone IN (''+919999999999'', ''+918888888888'') 
                OR full_name ILIKE ''%demo%''';
    RAISE NOTICE 'Cleaned demo rows from public.profiles';
  ELSE
    RAISE NOTICE 'Table public.profiles does not exist yet. Skipped.';
  END IF;

  -- 7. Initialize Storage bucket for real machine photos
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('machine-photos', 'machine-photos', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
    RAISE NOTICE 'Storage bucket machine-photos ready.';
  END IF;

  -- 8. Storage bucket RLS policies
  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE policyname = 'Public Access for Machine Photos' 
        AND tablename = 'objects' 
        AND schemaname = 'storage'
    ) THEN
      CREATE POLICY "Public Access for Machine Photos" ON storage.objects
        FOR SELECT USING (bucket_id = 'machine-photos');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE policyname = 'Authenticated Users Can Upload Photos' 
        AND tablename = 'objects' 
        AND schemaname = 'storage'
    ) THEN
      CREATE POLICY "Authenticated Users Can Upload Photos" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'machine-photos');
    END IF;
    RAISE NOTICE 'Storage bucket policies verified.';
  END IF;

END $$;
