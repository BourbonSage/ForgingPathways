-- Tighten is_case_manager_of: a soft-deleted participant should NOT be
-- considered managed by any partner. This automatically excludes deleted
-- participants from every RLS policy that relies on this helper
-- (profiles read/update, user_tasks, task_claims) and from the
-- award_credits_for_verified_task / reject_user_task RPCs.
CREATE OR REPLACE FUNCTION public.is_case_manager_of(_manager_id uuid, _participant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _participant_id
      AND case_manager_id = _manager_id
      AND deleted_at IS NULL
  )
$$;

COMMENT ON FUNCTION public.is_case_manager_of(uuid, uuid) IS
'Read-only helper for RLS policies. Restricted to signed-in users. Returns true only when the participant is NOT soft-deleted (deleted_at IS NULL).';
