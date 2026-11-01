-- ==============================================================================
-- Migration: PostGIS, Machine Geolocation, and Distance-Based Search
-- Safe to execute multiple times (idempotent)
-- ==============================================================================

-- 1. Enable PostGIS extension for spatial distance calculations
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add latitude, longitude, and geography point to machines
DO $$
BEGIN
  IF to_regclass('public.machines') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'latitude'
    ) THEN
      ALTER TABLE public.machines ADD COLUMN latitude NUMERIC(10, 7);
      RAISE NOTICE 'Added latitude to public.machines';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'longitude'
    ) THEN
      ALTER TABLE public.machines ADD COLUMN longitude NUMERIC(10, 7);
      RAISE NOTICE 'Added longitude to public.machines';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'geog'
    ) THEN
      ALTER TABLE public.machines ADD COLUMN geog geography(Point, 4326);
      RAISE NOTICE 'Added geog to public.machines';
    END IF;
  END IF;
END $$;

-- 3. Automatic trigger to synchronize geog Point from latitude & longitude
CREATE OR REPLACE FUNCTION public.sync_machine_geog()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_machine_geog ON public.machines;
CREATE TRIGGER trg_sync_machine_geog
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.sync_machine_geog();

-- Spatial GIST index for fast distance and radius queries
CREATE INDEX IF NOT EXISTS idx_machines_geog ON public.machines USING gist (geog);

-- 4. Upgraded search_machines function supporting Coordinates, Radius, and Fuzzy District/Village
DROP FUNCTION IF EXISTS public.search_machines(TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS public.search_machines(TEXT, TEXT, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.search_machines(
  p_crop TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_district TEXT DEFAULT NULL,
  p_needed_date DATE DEFAULT NULL,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT NULL
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
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ,
  distance_km REAL,
  match_type TEXT,
  match_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_has_coords BOOLEAN;
  v_user_pt geography;
BEGIN
  v_has_coords := (p_lat IS NOT NULL AND p_lng IS NOT NULL);
  IF v_has_coords THEN
    v_user_pt := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  END IF;

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
    m.latitude,
    m.longitude,
    m.created_at,
    -- Distance in Kilometers
    (
      CASE 
        WHEN v_has_coords AND m.geog IS NOT NULL 
          THEN ROUND((ST_Distance(m.geog, v_user_pt) / 1000.0)::numeric, 1)::REAL
        ELSE NULL::REAL
      END
    ) AS distance_km,
    -- Match label: same_village, same_district, nearby, or distance
    (
      CASE
        WHEN v_has_coords AND m.geog IS NOT NULL THEN 'distance'
        WHEN p_village IS NOT NULL AND LOWER(TRIM(m.village)) = LOWER(TRIM(p_village)) THEN 'same_village'
        WHEN p_district IS NOT NULL AND LOWER(TRIM(m.district)) = LOWER(TRIM(p_district)) THEN 'same_district'
        ELSE 'nearby'
      END
    ) AS match_type,
    -- Multi-tier matching score
    (
      (CASE 
        WHEN p_village IS NOT NULL AND LOWER(TRIM(m.village)) = LOWER(TRIM(p_village)) THEN 20.0
        WHEN p_village IS NOT NULL AND p_village <> '' THEN similarity(LOWER(m.village), LOWER(p_village)) * 10.0
        ELSE 0.0 
       END)
      +
      (CASE 
        WHEN p_district IS NOT NULL AND LOWER(TRIM(m.district)) = LOWER(TRIM(p_district)) THEN 10.0
        WHEN p_district IS NOT NULL AND p_district <> '' AND p_district <> 'All' 
          THEN similarity(LOWER(m.district), LOWER(p_district)) * 5.0
        ELSE 0.0 
       END)
      +
      (CASE 
        WHEN p_crop IS NOT NULL AND p_crop <> '' AND p_crop <> 'All' AND p_crop = ANY(m.crops) THEN 5.0 
        ELSE 0.0 
       END)
    )::REAL AS match_score
  FROM public.machines m
  WHERE m.is_active = true
    -- Exclude machines marked busy on requested date
    AND (
      p_needed_date IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.machine_busy_dates b 
        WHERE b.machine_id = m.id AND b.busy_date = p_needed_date
      )
    )
    -- Exclude machines with paid/confirmed booking on requested date
    AND (
      p_needed_date IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.bookings bk 
        WHERE bk.machine_id = m.id 
          AND bk.booking_date = p_needed_date 
          AND bk.status IN ('confirmed', 'paid')
      )
    )
    -- Crop match filter
    AND (
      p_crop IS NULL OR p_crop = '' OR p_crop = 'All' OR p_crop = ANY(m.crops)
    )
    -- Distance radius filter (if coordinate search)
    AND (
      NOT v_has_coords 
      OR p_radius_km IS NULL 
      OR m.geog IS NULL
      OR ST_DWithin(m.geog, v_user_pt, p_radius_km * 1000.0)
    )
    -- Text fallback filters (if not searching by coordinates)
    AND (
      v_has_coords
      OR (
        (p_village IS NULL OR p_village = '' OR similarity(LOWER(m.village), LOWER(p_village)) > 0.15 OR LOWER(m.district) = LOWER(p_district))
        AND
        (p_district IS NULL OR p_district = '' OR p_district = 'All' OR similarity(LOWER(m.district), LOWER(p_district)) > 0.2 OR LOWER(m.district) LIKE '%' || LOWER(p_district) || '%')
      )
    )
  ORDER BY 
    CASE WHEN v_has_coords AND m.geog IS NOT NULL THEN (ST_Distance(m.geog, v_user_pt)) ELSE 99999999 END ASC,
    match_score DESC,
    m.created_at DESC;
END;
$$;

