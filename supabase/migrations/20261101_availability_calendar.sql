-- ==============================================================================
-- Migration: Machine Availability Calendar, Busy Dates & Booking Synchronization
-- Safe and idempotent (can run multiple times)
-- ==============================================================================

-- 1. Ensure columns status and note exist on public.machine_busy_dates
DO $$
BEGIN
  IF to_regclass('public.machine_busy_dates') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'machine_busy_dates' 
        AND column_name = 'status'
    ) THEN
      ALTER TABLE public.machine_busy_dates ADD COLUMN status TEXT DEFAULT 'busy';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'machine_busy_dates' 
        AND column_name = 'note'
    ) THEN
      ALTER TABLE public.machine_busy_dates ADD COLUMN note VARCHAR(100);
    END IF;
  END IF;
END $$;

-- 2. Constraints and indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_busy_date_status'
  ) THEN
    ALTER TABLE public.machine_busy_dates 
    ADD CONSTRAINT chk_busy_date_status CHECK (status IN ('busy', 'booked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_machine_busy_dates_machine_date 
  ON public.machine_busy_dates (machine_id, busy_date);

CREATE INDEX IF NOT EXISTS idx_machine_busy_dates_status 
  ON public.machine_busy_dates (status);

-- 3. Automatic Synchronization Trigger: Bookings -> Machine Busy Dates
CREATE OR REPLACE FUNCTION public.sync_booking_to_busy_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'paid') THEN
    INSERT INTO public.machine_busy_dates (
      machine_id,
      busy_date,
      status,
      note,
      created_at
    )
    VALUES (
      NEW.machine_id,
      NEW.booking_date,
      'booked',
      'Confirmed farmer booking',
      timezone('utc'::text, now())
    )
    ON CONFLICT (machine_id, busy_date) 
    DO UPDATE SET 
      status = 'booked',
      note = 'Confirmed farmer booking';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_booking_busy_date'
  ) THEN
    CREATE TRIGGER trg_sync_booking_busy_date
      AFTER INSERT OR UPDATE OF status, booking_date, machine_id ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.sync_booking_to_busy_date();
  END IF;
END $$;

-- 4. Protection Trigger: Prevent owners or clients from clearing 'booked' dates or adding past dates
CREATE OR REPLACE FUNCTION public.protect_busy_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'booked' THEN
      RAISE EXCEPTION 'Cannot remove a booked harvest date. Active farmer bookings must be cancelled first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.busy_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot block dates in the past. Date must be today or later.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND NEW.status <> 'booked' THEN
      RAISE EXCEPTION 'Cannot change status of a booked harvest date.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_busy_dates'
  ) THEN
    CREATE TRIGGER trg_protect_busy_dates
      BEFORE INSERT OR UPDATE OR DELETE ON public.machine_busy_dates
      FOR EACH ROW EXECUTE FUNCTION public.protect_busy_dates();
  END IF;
END $$;

-- 5. Row Level Security Policies
ALTER TABLE public.machine_busy_dates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_busy_dates' AND policyname = 'Anyone can view machine busy dates'
  ) THEN
    CREATE POLICY "Anyone can view machine busy dates" ON public.machine_busy_dates
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_busy_dates' AND policyname = 'Owners can insert busy dates for own machines'
  ) THEN
    CREATE POLICY "Owners can insert busy dates for own machines" ON public.machine_busy_dates
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.machines m 
          WHERE m.id = machine_id AND (m.owner_id = auth.uid() OR public.is_admin())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_busy_dates' AND policyname = 'Owners can update busy dates for own machines'
  ) THEN
    CREATE POLICY "Owners can update busy dates for own machines" ON public.machine_busy_dates
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.machines m 
          WHERE m.id = machine_id AND (m.owner_id = auth.uid() OR public.is_admin())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_busy_dates' AND policyname = 'Owners can delete unbooked busy dates for own machines'
  ) THEN
    CREATE POLICY "Owners can delete unbooked busy dates for own machines" ON public.machine_busy_dates
      FOR DELETE USING (
        status <> 'booked' AND EXISTS (
          SELECT 1 FROM public.machines m 
          WHERE m.id = machine_id AND (m.owner_id = auth.uid() OR public.is_admin())
        )
      );
  END IF;
END $$;

