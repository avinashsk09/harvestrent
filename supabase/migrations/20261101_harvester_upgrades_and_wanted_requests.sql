-- Idempotent schema migration for Harvester Types, Tech Specs, Machine Photos, and Wanted Requests

-- 1. Add harvester_type to machines
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS harvester_type TEXT;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'machines_harvester_type_check'
  ) THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_harvester_type_check 
    CHECK (harvester_type IS NULL OR harvester_type IN ('track', 'wheel'));
  END IF;
END $$;

-- 2. Add Tech Specs & Fuel columns to machines
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS fuel_policy TEXT,
ADD COLUMN IF NOT EXISTS driver_included BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS header_width_ft NUMERIC,
ADD COLUMN IF NOT EXISTS has_straw_chopper BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manufacture_year INTEGER,
ADD COLUMN IF NOT EXISTS condition TEXT,
ADD COLUMN IF NOT EXISTS min_acres NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS owner_note TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::TEXT[];

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_fuel_policy_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_fuel_policy_check 
    CHECK (fuel_policy IS NULL OR fuel_policy IN ('included', 'by_farmer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_header_width_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_header_width_check 
    CHECK (header_width_ft IS NULL OR (header_width_ft >= 4 AND header_width_ft <= 30));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_manufacture_year_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_manufacture_year_check 
    CHECK (manufacture_year IS NULL OR (manufacture_year >= 1990 AND manufacture_year <= EXTRACT(YEAR FROM NOW())::INTEGER));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_condition_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_condition_check 
    CHECK (condition IS NULL OR condition IN ('good', 'average', 'needs_care'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_min_acres_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_min_acres_check 
    CHECK (min_acres IS NULL OR (min_acres >= 0 AND min_acres <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_owner_note_check') THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_owner_note_check 
    CHECK (owner_note IS NULL OR LENGTH(owner_note) <= 300);
  END IF;
END $$;

-- 3. Create machine_photos table
CREATE TABLE IF NOT EXISTS public.machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.machine_photos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_photos' AND policyname = 'Anyone can view machine photos'
  ) THEN
    CREATE POLICY "Anyone can view machine photos"
    ON public.machine_photos FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_photos' AND policyname = 'Owners can manage their machine photos'
  ) THEN
    CREATE POLICY "Owners can manage their machine photos"
    ON public.machine_photos FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.machines m
        WHERE m.id = machine_photos.machine_id AND m.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 4. Create wanted_requests table
CREATE TABLE IF NOT EXISTS public.wanted_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  farmer_phone TEXT NOT NULL,
  crop TEXT NOT NULL,
  acres NUMERIC NOT NULL CHECK (acres >= 0.5 AND acres <= 500),
  district TEXT NOT NULL,
  village TEXT NOT NULL,
  needed_date DATE NOT NULL,
  harvester_type TEXT CHECK (harvester_type IS NULL OR harvester_type IN ('track', 'wheel')),
  note TEXT CHECK (note IS NULL OR LENGTH(note) <= 200),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'closed')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wanted_requests_open 
ON public.wanted_requests (district, needed_date, status, expires_at);

CREATE OR REPLACE FUNCTION public.check_wanted_requests_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_open_count INTEGER;
BEGIN
  IF NEW.status = 'open' THEN
    SELECT COUNT(*) INTO v_open_count
    FROM public.wanted_requests
    WHERE farmer_id = NEW.farmer_id
      AND status = 'open'
      AND expires_at > timezone('utc'::text, now())
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_open_count >= 3 THEN
      RAISE EXCEPTION 'Rate limit reached: Maximum 3 active open wanted requests permitted per farmer.';
    END IF;
  END IF;

  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := (NEW.needed_date::TIMESTAMP + INTERVAL '2 days');
  END IF;

  RETURN NEW;
END;
$$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_check_wanted_requests_rate_limit'
  ) THEN
    CREATE TRIGGER trg_check_wanted_requests_rate_limit
    BEFORE INSERT OR UPDATE ON public.wanted_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.check_wanted_requests_rate_limit();
  END IF;
END $$;

ALTER TABLE public.wanted_requests ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wanted_requests' AND policyname = 'Farmers can manage their own requests'
  ) THEN
    CREATE POLICY "Farmers can manage their own requests"
    ON public.wanted_requests FOR ALL
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wanted_requests' AND policyname = 'Machine owners can view open requests'
  ) THEN
    CREATE POLICY "Machine owners can view open requests"
    ON public.wanted_requests FOR SELECT
    USING (
      status = 'open' 
      AND expires_at > timezone('utc'::text, now())
      AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'owner'
      )
    );
  END IF;
END $$;

