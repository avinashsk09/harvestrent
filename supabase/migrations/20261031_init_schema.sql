-- Harvest Rentals Initial Schema Migration
-- Enables pg_trgm for fuzzy village/district search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Profiles Table (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'owner')),
  village TEXT,
  district TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Machines Table
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  machine_type TEXT NOT NULL,
  model_name TEXT,
  village TEXT NOT NULL,
  district TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  crops TEXT[] NOT NULL DEFAULT '{}',
  price_amount NUMERIC(10, 2) NOT NULL,
  price_unit TEXT NOT NULL CHECK (price_unit IN ('per_acre', 'per_hour', 'per_day')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigram indexes for fast fuzzy text search
CREATE INDEX IF NOT EXISTS idx_machines_village_trgm ON public.machines USING gin (village gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_machines_district_trgm ON public.machines USING gin (district gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_machines_crops ON public.machines USING gin (crops);
CREATE INDEX IF NOT EXISTS idx_machines_is_active ON public.machines (is_active);

-- 3. Machine Busy Dates Table
CREATE TABLE IF NOT EXISTS public.machine_busy_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  busy_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(machine_id, busy_date)
);

CREATE INDEX IF NOT EXISTS idx_busy_dates_machine_date ON public.machine_busy_dates (machine_id, busy_date);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  farmer_name TEXT NOT NULL,
  farmer_phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  acres NUMERIC(6, 2) NOT NULL DEFAULT 1,
  crop TEXT NOT NULL,
  price_amount NUMERIC(10, 2) NOT NULL,
  price_unit TEXT NOT NULL CHECK (price_unit IN ('per_acre', 'per_hour', 'per_day')),
  total_estimate NUMERIC(10, 2) NOT NULL,
  advance_amount NUMERIC(10, 2) NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('upi', 'card', 'netbanking', 'cash')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')) DEFAULT 'pending',
  receipt_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_machine_id ON public.bookings(machine_id);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id ON public.bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);

-- 5. Payments Table (Razorpay verification & test audit)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('created', 'success', 'failed', 'pending')),
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);

-- 6. Reports Table (Wrong listing / unreachable owner)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  reporter_phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Rate Limits Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT UNIQUE NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

-- 8. Rule-Based Search Function using pg_trgm and district fallback
CREATE OR REPLACE FUNCTION public.search_machines(
  p_crop TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_needed_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  owner_name TEXT,
  owner_phone TEXT,
  machine_type TEXT,
  model_name TEXT,
  village TEXT,
  district TEXT,
  photo_url TEXT,
  crops TEXT[],
  price_amount NUMERIC,
  price_unit TEXT,
  is_active BOOLEAN,
  description TEXT,
  created_at TIMESTAMPTZ,
  match_score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.owner_id,
    m.owner_name,
    m.owner_phone,
    m.machine_type,
    m.model_name,
    m.village,
    m.district,
    m.photo_url,
    m.crops,
    m.price_amount,
    m.price_unit,
    m.is_active,
    m.description,
    m.created_at,
    (
      (CASE 
        WHEN p_village IS NOT NULL AND p_village <> '' 
          THEN similarity(LOWER(m.village), LOWER(p_village)) * 10
        ELSE 0 
       END)
      +
      (CASE 
        WHEN p_district IS NOT NULL AND p_district <> '' AND p_district <> 'All' 
          THEN similarity(LOWER(m.district), LOWER(p_district)) * 5
        ELSE 0 
       END)
      +
      (CASE 
        WHEN p_crop IS NOT NULL AND p_crop <> '' AND p_crop <> 'All' AND p_crop = ANY(m.crops) 
          THEN 4.0 
        ELSE 0.0 
       END)
    )::REAL AS match_score
  FROM public.machines m
  WHERE m.is_active = true
    AND (
      p_needed_date IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.machine_busy_dates b 
        WHERE b.machine_id = m.id AND b.busy_date = p_needed_date
      )
    )
    AND (
      p_needed_date IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.bookings bk 
        WHERE bk.machine_id = m.id 
          AND bk.booking_date = p_needed_date 
          AND bk.status IN ('confirmed', 'paid')
      )
    )
    AND (
      p_crop IS NULL OR p_crop = '' OR p_crop = 'All' OR p_crop = ANY(m.crops)
    )
    AND (
      (p_village IS NULL OR p_village = '' OR similarity(LOWER(m.village), LOWER(p_village)) > 0.15 OR LOWER(m.district) = LOWER(p_district))
      AND
      (p_district IS NULL OR p_district = '' OR p_district = 'All' OR similarity(LOWER(m.district), LOWER(p_district)) > 0.2 OR LOWER(m.district) LIKE '%' || LOWER(p_district) || '%')
    )
  ORDER BY match_score DESC, m.created_at DESC;
END;
$$;

-- Enable Row Level Security (RLS) safely
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_busy_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 9. Idempotent RLS Policies (Drop if exists before create)

-- Machines policies
DROP POLICY IF EXISTS "Public machines are viewable by everyone" ON public.machines;
CREATE POLICY "Public machines are viewable by everyone" ON public.machines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can insert their machines" ON public.machines;
CREATE POLICY "Owners can insert their machines" ON public.machines FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update their own machines" ON public.machines;
CREATE POLICY "Owners can update their own machines" ON public.machines FOR UPDATE USING (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "Owners can delete their own machines" ON public.machines;
CREATE POLICY "Owners can delete their own machines" ON public.machines FOR DELETE USING (auth.uid() = owner_id OR owner_id IS NULL);

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
CREATE POLICY "Public profiles are readable" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their profile" ON public.profiles;
CREATE POLICY "Users can create their profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
CREATE POLICY "Users can update their profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Busy dates policies
DROP POLICY IF EXISTS "Busy dates viewable by everyone" ON public.machine_busy_dates;
CREATE POLICY "Busy dates viewable by everyone" ON public.machine_busy_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage busy dates" ON public.machine_busy_dates;
CREATE POLICY "Owners can manage busy dates" ON public.machine_busy_dates FOR ALL USING (true);

-- Bookings policies
DROP POLICY IF EXISTS "Users can view bookings" ON public.bookings;
CREATE POLICY "Users can view bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create booking" ON public.bookings;
CREATE POLICY "Anyone can create booking" ON public.bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owners and farmers can update booking" ON public.bookings;
CREATE POLICY "Owners and farmers can update booking" ON public.bookings FOR UPDATE USING (true);

-- Payments policies
DROP POLICY IF EXISTS "Payments viewable" ON public.payments;
CREATE POLICY "Payments viewable" ON public.payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Payments insertable" ON public.payments;
CREATE POLICY "Payments insertable" ON public.payments FOR INSERT WITH CHECK (true);

-- Reports policies
DROP POLICY IF EXISTS "Anyone can insert report" ON public.reports;
CREATE POLICY "Anyone can insert report" ON public.reports FOR INSERT WITH CHECK (true);
