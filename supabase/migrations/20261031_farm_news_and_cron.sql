-- ==============================================================================
-- Migration: Genuine Daily 6 AM Farm News & Resend Notification System
-- Safe to execute multiple times (idempotent)
-- ==============================================================================

-- 1. Create news_items table
CREATE TABLE IF NOT EXISTS public.news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  state TEXT DEFAULT 'Karnataka',
  category TEXT DEFAULT 'agriculture',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON public.news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON public.news_items(source_name);

-- 2. Create news_runs table to log execution history
CREATE TABLE IF NOT EXISTS public.news_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  items_fetched INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  error_log TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_runs_at ON public.news_runs(run_at DESC);

-- 3. Add email_news_subscribed preference to profiles
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'email_news_subscribed'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN email_news_subscribed BOOLEAN NOT NULL DEFAULT true;
      RAISE NOTICE 'Added email_news_subscribed to public.profiles';
    END IF;
  END IF;
END $$;

-- 4. Row Level Security Policies
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_runs ENABLE ROW LEVEL SECURITY;

-- news_items: Readable by all users
DROP POLICY IF EXISTS "Public news is viewable by all" ON public.news_items;
CREATE POLICY "Public news is viewable by all" ON public.news_items
  FOR SELECT USING (true);

-- news_runs: Readable by admins only
DROP POLICY IF EXISTS "Admins can view news runs" ON public.news_runs;
CREATE POLICY "Admins can view news runs" ON public.news_runs
  FOR SELECT USING (public.is_admin());

-- 5. Daily 6:00 AM IST (00:30 UTC) Cron Job Registration
-- Uses pg_cron and pg_net if installed on the Supabase project
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    -- Unschedules existing job if present
    PERFORM cron.unschedule('daily-6am-farm-news')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-6am-farm-news');

    -- Schedules every morning at 00:30 UTC (6:00 AM India Standard Time)
    PERFORM cron.schedule(
      'daily-6am-farm-news',
      '30 0 * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/fetch-farm-news',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
      $$
    );
    RAISE NOTICE 'Scheduled daily-6am-farm-news cron at 00:30 UTC (6:00 AM IST)';
  ELSE
    RAISE NOTICE 'pg_cron extension not active. You can trigger fetch-farm-news via Supabase Scheduled Functions.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notice: pg_cron setup skipped (%s)', SQLERRM;
END $$;

