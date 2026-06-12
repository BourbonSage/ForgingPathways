
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS notes text;

-- Stop awarding credits on claim (legacy table). Verification is the new gate.
DROP TRIGGER IF EXISTS task_claims_award_credits ON public.task_claims;
