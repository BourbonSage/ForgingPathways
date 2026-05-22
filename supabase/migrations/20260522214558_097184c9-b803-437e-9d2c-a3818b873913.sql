
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'North Charleston',
  duration text NOT NULL DEFAULT '1 hour',
  org text NOT NULL DEFAULT 'Lowcountry Food Bank',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in views active tasks" ON public.tasks
  FOR SELECT TO authenticated USING (active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.claim_status AS ENUM ('claimed', 'verified');

CREATE TABLE public.task_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status claim_status NOT NULL DEFAULT 'claimed',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (user_id, task_id)
);

ALTER TABLE public.task_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own claims" ON public.task_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all claims" ON public.task_claims
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own claims" ON public.task_claims
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update claims" ON public.task_claims
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_task_claims_user ON public.task_claims(user_id);
CREATE INDEX idx_task_claims_claimed_at ON public.task_claims(claimed_at);

CREATE OR REPLACE FUNCTION public.award_credits_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  award integer;
BEGIN
  SELECT credits INTO award FROM public.tasks WHERE id = NEW.task_id;
  IF award IS NULL THEN award := 0; END IF;
  UPDATE public.profiles SET credits = COALESCE(credits, 0) + award WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_claims_award_credits
  AFTER INSERT ON public.task_claims
  FOR EACH ROW EXECUTE FUNCTION public.award_credits_on_claim();

INSERT INTO public.tasks (title, description, credits, location, duration) VALUES
  ('Pack 50 Meal Kits', 'Assemble shelf-stable meal kits for families across the Lowcountry. Friendly crew, easy first shift.', 10, 'North Charleston', '2 hours'),
  ('Sort Fresh Produce', 'Sort donated fruits and vegetables into family-sized boxes. Light lifting.', 8, 'North Charleston', '2 hours'),
  ('Box Donations for Distribution', 'Pack boxed donations onto pallets for partner agencies to pick up.', 7, 'North Charleston', '1.5 hours'),
  ('Kitchen Support Shift', 'Help prep ingredients and clean stations in the community kitchen.', 12, 'North Charleston', '3 hours'),
  ('Pack Weekend Backpacks for Kids', 'Fill backpacks with weekend meals for students in need.', 9, 'North Charleston', '2 hours'),
  ('Stock the Mobile Pantry Truck', 'Load the mobile pantry for neighborhood distribution stops.', 8, 'North Charleston', '1.5 hours'),
  ('Greet & Check-In Visitors', 'Welcome visitors at the front desk and help them find resources.', 5, 'North Charleston', '1 hour'),
  ('Inventory & Date-Check Canned Goods', 'Audit shelves and pull expired items so families only get safe food.', 6, 'North Charleston', '1.5 hours');
