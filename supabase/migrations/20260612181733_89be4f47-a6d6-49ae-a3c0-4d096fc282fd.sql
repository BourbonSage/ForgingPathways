
-- =====================================================================
-- Final hardening pass
-- =====================================================================
-- Security model recap (recorded on tables for future readers):
--   * profiles.credits / is_admin / case_manager_id / email are
--     protected by profiles_guard_privileged_columns. Participants
--     cannot change them directly; admins and (where appropriate)
--     case managers can.
--   * pathway_credit_transactions has NO user-facing INSERT/UPDATE/
--     DELETE policy. Writes only happen through award_credits_for_
--     verified_task and redeem_reward (both SECURITY DEFINER, role-
--     gated).
--   * user_tasks / task_claims permit participants to insert their own
--     rows ONLY in non-verified states, and to update their own rows
--     ONLY through transitions that exclude "verified". Verification
--     is performed exclusively by partner/admin via the award RPC.
--   * realtime.messages is RLS-restricted to topics prefixed with the
--     subscriber's auth.uid().
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tighten user_tasks INSERT — block self-verification at creation
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users claim own user_tasks" ON public.user_tasks;
CREATE POLICY "Users claim own user_tasks"
ON public.user_tasks
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verified = false
  AND status::text IN ('claimed', 'pending_verification')
  AND assigned_by IS NULL
);


-- ---------------------------------------------------------------------
-- 2. Tighten task_claims INSERT — block self-verification at creation
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users create own claims" ON public.task_claims;
CREATE POLICY "Users create own claims"
ON public.task_claims
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status::text IN ('claimed', 'pending_verification')
  AND assigned_by IS NULL
);


-- ---------------------------------------------------------------------
-- 3. Block participants from changing their own profile email
-- ---------------------------------------------------------------------
-- Email is used as the lookup key for one-time invite codes
-- (redeem_passcode). Allowing self-edit would let a user retarget an
-- invite intended for another email.
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR coalesce(current_setting('app.credit_mutation', true), '') = '1'
    ) THEN
      RAISE EXCEPTION 'credits column cannot be updated directly';
    END IF;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'is_admin column cannot be updated directly';
    END IF;
  END IF;

  IF NEW.case_manager_id IS DISTINCT FROM OLD.case_manager_id THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'partner'::app_role)
    ) THEN
      RAISE EXCEPTION 'case_manager_id cannot be updated by participants';
    END IF;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'partner'::app_role)
    ) THEN
      RAISE EXCEPTION 'email cannot be updated directly; contact an administrator';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 4. Retire the legacy redemptions write path
-- ---------------------------------------------------------------------
-- All redemptions are now created through redeem_reward(), which writes
-- a negative row into the credit ledger. The direct INSERT policy and
-- the deduct_credits_on_redemption trigger are no longer used and were
-- previously exploitable via a negative cost value (now blocked by the
-- profiles guard trigger, but the dead path should not remain).
DROP POLICY IF EXISTS "Users create own redemptions" ON public.redemptions;

DROP TRIGGER IF EXISTS deduct_credits_on_redemption_trigger ON public.redemptions;
DROP TRIGGER IF EXISTS deduct_credits_on_redemption ON public.redemptions;
-- Function is left in place (harmless without trigger) in case it is
-- referenced elsewhere; it can be dropped manually once verified unused.


-- ---------------------------------------------------------------------
-- 5. Documentation comments
-- ---------------------------------------------------------------------
COMMENT ON COLUMN public.profiles.credits IS
  'Forge credits balance. Only mutated by apply_credit_transaction trigger inside the controlled credit_mutation session window. Direct UPDATE by participants is blocked by profiles_guard_privileged_columns.';

COMMENT ON COLUMN public.profiles.email IS
  'Auth email. Self-update is blocked because invite codes are matched by email; only admins/case managers can change it.';

COMMENT ON TABLE public.pathway_credit_transactions IS
  'Credit ledger. Append-only. No user-facing INSERT/UPDATE/DELETE policies. Writes only via award_credits_for_verified_task() and redeem_reward() (both SECURITY DEFINER, role-gated).';

COMMENT ON TABLE public.user_tasks IS
  'Participant task progress. Participants may create rows in claimed/pending_verification states only; verification (status=verified, verified=true) is performed exclusively by award_credits_for_verified_task().';
