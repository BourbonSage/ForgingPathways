
-- 1. Extend user_tasks
DO $$ BEGIN
  CREATE TYPE public.user_task_status AS ENUM ('claimed','pending_verification','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_tasks
  ADD COLUMN IF NOT EXISTS status public.user_task_status NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Backfill status from existing verified flag
UPDATE public.user_tasks SET status = 'verified' WHERE verified = true AND status = 'claimed';

CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_by ON public.user_tasks(assigned_by);

-- 2. Extend legacy task_claims similarly (status enum already exists)
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- 3. Add case_manager_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS case_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_case_manager ON public.profiles(case_manager_id);

-- 4. Helper function: is the current user the case manager of _participant_id?
CREATE OR REPLACE FUNCTION public.is_case_manager_of(_manager_id uuid, _participant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _participant_id AND case_manager_id = _manager_id
  )
$$;

-- 5. RLS policies for partners (case managers) on overseen participants
-- profiles: partners already can view all in alpha; add UPDATE for assigned participants
DROP POLICY IF EXISTS "Case managers update assigned profiles" ON public.profiles;
CREATE POLICY "Case managers update assigned profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_case_manager_of(auth.uid(), id))
  WITH CHECK (public.is_case_manager_of(auth.uid(), id));

-- user_tasks: partners can view/manage tasks of overseen participants
DROP POLICY IF EXISTS "Partners view overseen user_tasks" ON public.user_tasks;
CREATE POLICY "Partners view overseen user_tasks" ON public.user_tasks
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Partners update overseen user_tasks" ON public.user_tasks;
CREATE POLICY "Partners update overseen user_tasks" ON public.user_tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Partners assign user_tasks" ON public.user_tasks;
CREATE POLICY "Partners assign user_tasks" ON public.user_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'partner')
    AND public.is_case_manager_of(auth.uid(), user_id)
    AND assigned_by = auth.uid()
  );

-- task_claims: same for legacy table
DROP POLICY IF EXISTS "Partners view overseen claims" ON public.task_claims;
CREATE POLICY "Partners view overseen claims" ON public.task_claims
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Partners update overseen claims" ON public.task_claims;
CREATE POLICY "Partners update overseen claims" ON public.task_claims
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  );

-- pathway_credit_transactions: partners can view overseen participants' tx
DROP POLICY IF EXISTS "Partners view overseen credit tx" ON public.pathway_credit_transactions;
CREATE POLICY "Partners view overseen credit tx" ON public.pathway_credit_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'partner') AND public.is_case_manager_of(auth.uid(), user_id)
  );
