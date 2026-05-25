-- Normalize empties so uniqueness can be enforced
UPDATE public.profiles SET phone = NULL WHERE phone = '';

-- ---------- profiles ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills text[],
  ADD COLUMN IF NOT EXISTS housing_goals text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone) WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_is_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    UPDATE public.profiles SET is_admin = true WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'admin') THEN
      UPDATE public.profiles SET is_admin = false WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS trg_sync_is_admin_ins ON public.user_roles;
CREATE TRIGGER trg_sync_is_admin_ins AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_admin();

DROP TRIGGER IF EXISTS trg_sync_is_admin_del ON public.user_roles;
CREATE TRIGGER trg_sync_is_admin_del AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_admin();

UPDATE public.profiles p
   SET is_admin = EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');

-- ---------- tasks ----------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS partner text NOT NULL DEFAULT 'Lowcountry Food Bank',
  ADD COLUMN IF NOT EXISTS est_hours numeric,
  ADD COLUMN IF NOT EXISTS pathway_credits integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','claimed','completed','cancelled'));

UPDATE public.tasks SET pathway_credits = credits WHERE pathway_credits IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);

-- ---------- user_tasks ----------
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  verified boolean NOT NULL DEFAULT false,
  verification_method text,
  UNIQUE (user_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON public.user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON public.user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_claimed_at ON public.user_tasks(claimed_at);

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own user_tasks" ON public.user_tasks;
CREATE POLICY "Users view own user_tasks" ON public.user_tasks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all user_tasks" ON public.user_tasks;
CREATE POLICY "Admins view all user_tasks" ON public.user_tasks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users claim own user_tasks" ON public.user_tasks;
CREATE POLICY "Users claim own user_tasks" ON public.user_tasks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own user_tasks" ON public.user_tasks;
CREATE POLICY "Users update own user_tasks" ON public.user_tasks
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins update user_tasks" ON public.user_tasks;
CREATE POLICY "Admins update user_tasks" ON public.user_tasks
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- pathway_credit_transactions ----------
CREATE TABLE IF NOT EXISTS public.pathway_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('earned_task','redeemed_reward','adjustment')),
  description text,
  balance_after integer NOT NULL DEFAULT 0,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pct_user ON public.pathway_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pct_task ON public.pathway_credit_transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_pct_created ON public.pathway_credit_transactions(created_at);

ALTER TABLE public.pathway_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ledger" ON public.pathway_credit_transactions;
CREATE POLICY "Users view own ledger" ON public.pathway_credit_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all ledger" ON public.pathway_credit_transactions;
CREATE POLICY "Admins view all ledger" ON public.pathway_credit_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own ledger" ON public.pathway_credit_transactions;
CREATE POLICY "Users insert own ledger" ON public.pathway_credit_transactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  SELECT COALESCE(credits, 0) INTO current_balance
    FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF current_balance IS NULL THEN current_balance := 0; END IF;
  new_balance := current_balance + NEW.amount;
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient pathway credits';
  END IF;
  NEW.balance_after := new_balance;
  UPDATE public.profiles SET credits = new_balance WHERE id = NEW.user_id;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_apply_credit_tx ON public.pathway_credit_transactions;
CREATE TRIGGER trg_apply_credit_tx BEFORE INSERT ON public.pathway_credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_transaction();

-- ---------- redemptions ----------
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS reward_name text,
  ADD COLUMN IF NOT EXISTS pathway_credits_used integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','fulfilled'));

UPDATE public.redemptions
   SET reward_name = COALESCE(reward_name, reward_title),
       pathway_credits_used = COALESCE(pathway_credits_used, cost);

CREATE INDEX IF NOT EXISTS idx_redemptions_user ON public.redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_created ON public.redemptions(created_at);

-- ---------- Realtime ----------
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.user_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.pathway_credit_transactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pathway_credit_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
