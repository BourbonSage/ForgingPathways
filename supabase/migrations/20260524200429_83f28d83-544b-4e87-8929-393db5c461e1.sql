CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_key text NOT NULL,
  reward_title text NOT NULL,
  cost integer NOT NULL CHECK (cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create own redemptions" ON public.redemptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.deduct_credits_on_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  SELECT credits INTO current_credits FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF current_credits IS NULL OR current_credits < NEW.cost THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  UPDATE public.profiles SET credits = current_credits - NEW.cost WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_credits_on_redemption() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER deduct_credits_before_redemption
  BEFORE INSERT ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_credits_on_redemption();