-- Contador de cancelaciones injustificadas del organizador
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cancellations_count INTEGER NOT NULL DEFAULT 0;

-- Trigger: incrementar automáticamente cuando un partido pasa a 'cancelled'
CREATE OR REPLACE FUNCTION public.increment_organizer_cancellations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.users
      SET cancellations_count = cancellations_count + 1
      WHERE id = NEW.organizer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_cancelled ON public.matches;
CREATE TRIGGER on_match_cancelled
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.increment_organizer_cancellations();
