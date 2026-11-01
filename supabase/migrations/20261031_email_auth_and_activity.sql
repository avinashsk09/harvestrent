-- ==============================================================================
-- Migration: Email & Password Auth, Activity Logs, and Admin Access
-- Safe to execute multiple times (idempotent)
-- ==============================================================================

-- 1. Ensure profiles table supports 'admin' role and tracks last_sign_in_at
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    -- Update role check constraint to include 'admin'
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('farmer', 'owner', 'admin'));

    -- Add last_sign_in_at if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'last_sign_in_at'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN last_sign_in_at TIMESTAMPTZ;
      RAISE NOTICE 'Added last_sign_in_at to public.profiles';
    END IF;
  END IF;
END $$;

-- 2. Create auth_events table to log sign_up, sign_in, and sign_out
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sign_up', 'sign_in', 'sign_out')),
  role TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON public.auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON public.auth_events(event_type);

-- 3. Helper function: is_admin() (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. Automatic Profile & Sign-up Event Creation Trigger on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'farmer');
  IF v_role NOT IN ('farmer', 'owner', 'admin') THEN
    v_role := 'farmer';
  END IF;

  -- Create or sync profile row
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    created_at,
    updated_at,
    last_sign_in_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    v_phone,
    v_role,
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE 
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
      THEN EXCLUDED.full_name 
      ELSE public.profiles.full_name 
    END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    updated_at = timezone('utc'::text, now());

  -- Record initial 'sign_up' event
  INSERT INTO public.auth_events (
    user_id,
    event_type,
    role,
    user_agent,
    created_at
  )
  VALUES (
    NEW.id,
    'sign_up',
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'user_agent', 'Account Registration'),
    timezone('utc'::text, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Secure Function for Client to Record sign_in and sign_out Events
CREATE OR REPLACE FUNCTION public.record_auth_event(
  p_event_type TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Operation requires an active user session.';
  END IF;

  IF p_event_type NOT IN ('sign_in', 'sign_out') THEN
    RAISE EXCEPTION 'Invalid event type. Must be sign_in or sign_out.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.auth_events (
    user_id,
    event_type,
    role,
    user_agent,
    created_at
  )
  VALUES (
    v_user_id,
    p_event_type,
    v_role,
    COALESCE(p_user_agent, 'Harvest Rentals Web App'),
    timezone('utc'::text, now())
  );

  IF p_event_type = 'sign_in' THEN
    UPDATE public.profiles
    SET last_sign_in_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- 6. Admin Function: Get All Profiles & Auth Events
CREATE OR REPLACE FUNCTION public.get_admin_activity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_users JSONB;
  v_events JSONB;
BEGIN
  -- Strict permission check
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  SELECT jsonb_agg(u) INTO v_users
  FROM (
    SELECT 
      id,
      full_name,
      email,
      phone,
      role,
      created_at,
      last_sign_in_at
    FROM public.profiles
    ORDER BY created_at DESC
  ) u;

  SELECT jsonb_agg(e) INTO v_events
  FROM (
    SELECT 
      a.id,
      a.user_id,
      a.event_type,
      a.role,
      a.user_agent,
      a.created_at,
      p.email AS user_email,
      p.full_name AS user_name
    FROM public.auth_events a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 300
  ) e;

  RETURN jsonb_build_object(
    'users', COALESCE(v_users, '[]'::jsonb),
    'events', COALESCE(v_events, '[]'::jsonb)
  );
END;
$$;

-- 7. Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users read/update own; admins read/update all
DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile or admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile or admin" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Auth Events: Users can only read their own events; admin can read all; direct browser edits/deletes blocked
DROP POLICY IF EXISTS "Users can read own auth events" ON public.auth_events;
CREATE POLICY "Users can read own auth events" ON public.auth_events
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

