-- ==============================================================================
-- Migration: Google OAuth Avatar & Profile Row Level Security
-- ==============================================================================

-- 1. Add avatar_url column to profiles if it does not exist
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'avatar_url'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
      RAISE NOTICE 'Added avatar_url to public.profiles';
    END IF;
  END IF;
END $$;

-- 2. Restrict Profile RLS so users can read and update only their own row
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    -- Drop old permissive policies
    DROP POLICY IF EXISTS "Public profiles are readable" ON public.profiles;
    DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can create their profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

    -- Strict per-user policies
    CREATE POLICY "Users can read own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);

    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);

    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);

    RAISE NOTICE 'Updated RLS on public.profiles to strict self-access';
  END IF;
END $$;

