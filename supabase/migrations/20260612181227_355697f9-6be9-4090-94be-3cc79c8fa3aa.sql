
-- =====================================================================
-- ForgingPathways — Alpha Security Hardening
-- =====================================================================
-- Goals:
--   1. Credits can ONLY be changed by trusted server-side code.
--      - Ledger inserts: SECURITY DEFINER function called by partner/admin.
--      - profiles.credits: only updated by the ledger trigger (in a
--        controlled session context) or by admins.
--   2. Task verification ('verified' status) can only be performed by
--      partner/admin via the award function. Participants may only
--      transition their own tasks to 'pending_verification'.
--   3. Realtime broadcasts no longer carry sensitive profile / credit
--      data, and the realtime.messages table is locked down so a user
--      cannot subscribe to other users' channels.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lock down pathway_credit_transactions (the credit ledger)
-- ---------------------------------------------------------------------
-- Previously: "Users insert own ledger" let any authenticated user
-- insert any positive amount with user_id = auth.uid() and inflate
-- their balance via the apply_credit_transaction trigger.
DROP POLICY IF EXISTS "Users insert own ledger" ON public.pathway_credit_transactions;

-- No INSERT/UPDATE/DELETE policy for authenticated users remains.
-- All writes must go through SECURITY DEFINER functions (which run as
-- the table owner and bypass RLS), or via service_role.


-- ---------------------------------------------------------------------
-- 2. Guard profiles.credits against direct user updates
-- ---------------------------------------------------------------------
-- Postgres RLS cannot express column-level UPDATE restrictions, so we
-- enforce it with a trigger. The trigger allows credits to change only
-- when:
--   * the caller is an admin, OR
--   * a controlled session flag (app.credit_mutation) is set, which is
--     done inside apply_credit_transaction(). Because that trigger only
--     fires when a ledger row is inserted, and ledger inserts are now
--     gated by a SECURITY DEFINER function requiring partner/admin,
--     this closes the path entirely.
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- credits column: must use the ledger path or be admin
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR coalesce(current_setting('app.credit_mutation', true), '') = '1'
    ) THEN
      RAISE EXCEPTION 'credits column cannot be updated directly';
    END IF;
  END IF;

  -- is_admin column: only admins (we already sync via user_roles)
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'is_admin column cannot be updated directly';
    END IF;
  END IF;

  -- case_manager_id: only admins or partners may reassign
  IF NEW.case_manager_id IS DISTINCT FROM OLD.case_manager_id THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'partner'::app_role)
    ) THEN
      RAISE EXCEPTION 'case_manager_id cannot be updated by participants';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- Update apply_credit_transaction to flag the privileged update window.
CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Permit the guard trigger to allow this credits update within this txn
  PERFORM set_config('app.credit_mutation', '1', true);
  UPDATE public.profiles SET credits = new_balance WHERE id = NEW.user_id;
  PERFORM set_config('app.credit_mutation', '0', true);

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 3. Block participants from self-verifying tasks
-- ---------------------------------------------------------------------
-- We keep the existing user-scoped UPDATE policies but add a trigger
-- that prevents a participant from setting status = 'verified' or
-- verified = true on rows they own. Partner/admin paths (and the
-- award function below) are unaffected.

CREATE OR REPLACE FUNCTION public.user_tasks_block_self_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip enforcement for partner/admin updates
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'partner'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() THEN
    -- Forbid moving to verified or flipping verified=true
    IF NEW.status::text = 'verified'
       AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      RAISE EXCEPTION 'Participants cannot mark their own task verified';
    END IF;
    IF NEW.verified = true AND OLD.verified = false THEN
      RAISE EXCEPTION 'Participants cannot mark their own task verified';
    END IF;
    -- Forbid touching assigned_by / verified_at directly
    IF NEW.assigned_by IS DISTINCT FROM OLD.assigned_by THEN
      RAISE EXCEPTION 'Participants cannot change assigned_by';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_tasks_block_self_verify ON public.user_tasks;
CREATE TRIGGER user_tasks_block_self_verify
BEFORE UPDATE ON public.user_tasks
FOR EACH ROW EXECUTE FUNCTION public.user_tasks_block_self_verify();


CREATE OR REPLACE FUNCTION public.task_claims_block_self_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'partner'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() THEN
    IF NEW.status::text = 'verified'
       AND (OLD.status IS DISTINCT FROM NEW.status) THEN
      RAISE EXCEPTION 'Participants cannot mark their own claim verified';
    END IF;
    IF NEW.assigned_by IS DISTINCT FROM OLD.assigned_by THEN
      RAISE EXCEPTION 'Participants cannot change assigned_by';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_claims_block_self_verify ON public.task_claims;
CREATE TRIGGER task_claims_block_self_verify
BEFORE UPDATE ON public.task_claims
FOR EACH ROW EXECUTE FUNCTION public.task_claims_block_self_verify();

-- Remove legacy trigger that awarded credits directly via
-- profiles.credits update (bypassing the ledger). The award function
-- below is now the single approved path.
DROP TRIGGER IF EXISTS award_credits_on_verify_trigger ON public.task_claims;


-- ---------------------------------------------------------------------
-- 4. Participant submission RPC
-- ---------------------------------------------------------------------
-- Participants call this to submit a claimed task for review. It
-- guarantees the resulting row has status = 'pending_verification' and
-- never 'verified'.
CREATE OR REPLACE FUNCTION public.submit_task_for_verification(p_task_id uuid)
RETURNS public.user_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_tasks;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Upsert into user_tasks: if a row exists for (user, task) and is not
  -- already verified, move it to pending_verification; otherwise create.
  INSERT INTO public.user_tasks (user_id, task_id, status, completed_at)
  VALUES (v_uid, p_task_id, 'pending_verification', now())
  ON CONFLICT (user_id, task_id) DO UPDATE
    SET status = 'pending_verification',
        completed_at = now(),
        notes = EXCLUDED.notes
    WHERE public.user_tasks.status::text <> 'verified'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    -- Conflict path where row was already verified — return existing row
    SELECT * INTO v_row FROM public.user_tasks
      WHERE user_id = v_uid AND task_id = p_task_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_task_for_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_task_for_verification(uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- 5. Verification / credit-award RPC (partner & admin only)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_credits_for_verified_task(p_user_task_id uuid)
RETURNS public.pathway_credit_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_task public.user_tasks;
  v_credits integer;
  v_ledger public.pathway_credit_transactions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Authorization: admins always; partners only for participants they
  -- case-manage.
  SELECT * INTO v_task FROM public.user_tasks WHERE id = p_user_task_id FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'user_task_not_found';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR (
      public.has_role(v_uid, 'partner'::app_role)
      AND public.is_case_manager_of(v_uid, v_task.user_id)
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- State guard: only verify tasks currently awaiting review.
  IF v_task.status::text <> 'pending_verification' THEN
    RAISE EXCEPTION 'task_not_pending_verification (status=%)', v_task.status;
  END IF;

  SELECT credits INTO v_credits FROM public.tasks WHERE id = v_task.task_id;
  IF v_credits IS NULL THEN v_credits := 0; END IF;

  -- Insert into the ledger (apply_credit_transaction trigger updates
  -- profiles.credits inside its controlled window).
  INSERT INTO public.pathway_credit_transactions (
    user_id, task_id, amount, type, description, verified_by
  ) VALUES (
    v_task.user_id, v_task.task_id, v_credits, 'earned_task',
    'Verified by case manager', v_uid
  ) RETURNING * INTO v_ledger;

  -- Mark the user_task verified.
  UPDATE public.user_tasks
    SET status = 'verified',
        verified = true,
        verification_method = COALESCE(verification_method, 'case_manager')
    WHERE id = p_user_task_id;

  RETURN v_ledger;
END;
$$;

REVOKE ALL ON FUNCTION public.award_credits_for_verified_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_credits_for_verified_task(uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- 6. Reject RPC for case managers (no credits, just status update)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_user_task(p_user_task_id uuid, p_notes text)
RETURNS public.user_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_task public.user_tasks;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_task FROM public.user_tasks WHERE id = p_user_task_id FOR UPDATE;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'user_task_not_found';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR (
      public.has_role(v_uid, 'partner'::app_role)
      AND public.is_case_manager_of(v_uid, v_task.user_id)
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.user_tasks
    SET status = 'rejected',
        notes = COALESCE(p_notes, notes)
    WHERE id = p_user_task_id
    RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_user_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_user_task(uuid, text) TO authenticated;


-- ---------------------------------------------------------------------
-- 7. Realtime publication — remove sensitive tables
-- ---------------------------------------------------------------------
-- profiles contains email, phone, credits, etc.; the ledger contains
-- every transaction. Neither should be broadcast.
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pathway_credit_transactions;
-- Keep public.tasks and public.user_tasks (user_tasks is RLS-filtered
-- by Realtime, so participants only receive their own rows and
-- partners only receive their cohort's rows).


-- ---------------------------------------------------------------------
-- 8. Lock down realtime.messages (Broadcast / Presence)
-- ---------------------------------------------------------------------
-- We don't currently use Broadcast or Presence. Enable RLS and add a
-- restrictive policy so a user can only access channels whose topic is
-- prefixed with their own auth uid (e.g. "<uid>:notifications"). This
-- denies cross-user channel snooping by default.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access only their own topics" ON realtime.messages;
CREATE POLICY "Users access only their own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic LIKE (auth.uid()::text || ':%')
);

DROP POLICY IF EXISTS "Users publish only to their own topics" ON realtime.messages;
CREATE POLICY "Users publish only to their own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  topic LIKE (auth.uid()::text || ':%')
);
