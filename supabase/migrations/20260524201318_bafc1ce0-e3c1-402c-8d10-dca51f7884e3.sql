
-- Drop existing insert-time award trigger if present
DROP TRIGGER IF EXISTS award_credits_on_claim_trigger ON public.task_claims;
DROP TRIGGER IF EXISTS award_credits_after_claim ON public.task_claims;
DROP TRIGGER IF EXISTS trg_award_credits_on_claim ON public.task_claims;

-- New function: award credits when claim transitions to 'verified'
CREATE OR REPLACE FUNCTION public.award_credits_on_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  award integer;
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    SELECT credits INTO award FROM public.tasks WHERE id = NEW.task_id;
    IF award IS NULL THEN award := 0; END IF;
    UPDATE public.profiles
      SET credits = COALESCE(credits, 0) + award
      WHERE id = NEW.user_id;
    IF NEW.verified_at IS NULL THEN
      NEW.verified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_credits_on_verify_trigger ON public.task_claims;
CREATE TRIGGER award_credits_on_verify_trigger
BEFORE UPDATE ON public.task_claims
FOR EACH ROW
EXECUTE FUNCTION public.award_credits_on_verify();

-- Allow users to update (verify) their own claims
DROP POLICY IF EXISTS "Users verify own claims" ON public.task_claims;
CREATE POLICY "Users verify own claims"
ON public.task_claims
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
