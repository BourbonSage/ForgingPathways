-- ============================================================================
-- Lock down internal SECURITY DEFINER functions and document security model.
-- ============================================================================

-- --- Trigger-only functions: no direct API callers needed -------------------
-- These run as table triggers; revoke EXECUTE from PUBLIC/anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.profiles_guard_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.task_claims_block_self_verify()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_tasks_block_self_verify()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_credit_transaction()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_credits_on_claim()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_credits_on_verify()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits_on_redemption()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_is_admin()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                     FROM PUBLIC, anon, authenticated;

-- --- Helper functions used by RLS / signed-in clients ----------------------
-- Revoke anonymous access; signed-in users retain EXECUTE.
REVOKE EXECUTE ON FUNCTION public.is_case_manager_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_passcode(text)          FROM PUBLIC, anon;

-- ============================================================================
-- Documentation: security model for each SECURITY DEFINER function.
-- ============================================================================

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS
'Read-only role check used by RLS policies and clients. Safe for any signed-in caller; reads only public.user_roles.';

COMMENT ON FUNCTION public.is_case_manager_of(uuid, uuid) IS
'Read-only helper for RLS policies. Restricted to signed-in users; reads only public.profiles.';

COMMENT ON FUNCTION public.log_admin_action(text, uuid, jsonb) IS
'Inserts an admin_audit_log entry. Caller must be authenticated AND have admin or partner role (enforced inside the function). Anonymous callers cannot execute.';

COMMENT ON FUNCTION public.redeem_passcode(text) IS
'Consumes a one-time passcode for the calling user. Requires authentication; passcode must be unused, unexpired, and (if scoped) match the caller email. Anonymous callers cannot execute.';

COMMENT ON FUNCTION public.redeem_reward(integer, text) IS
'Records a credit-spending ledger entry for the calling user. Requires authentication; rejects if balance is insufficient or cost is non-positive.';

COMMENT ON FUNCTION public.submit_task_for_verification(uuid) IS
'Marks a task as pending verification for the calling user. Requires authentication; never overwrites an already-verified row.';

COMMENT ON FUNCTION public.award_credits_for_verified_task(uuid) IS
'Verifies a participant task and awards credits. Caller must be admin, or a partner who is the case manager of the target participant. Only operates on rows currently in pending_verification.';

COMMENT ON FUNCTION public.reject_user_task(uuid, text) IS
'Rejects a pending participant task. Caller must be admin, or a partner who is the case manager of the target participant.';

COMMENT ON FUNCTION public.apply_credit_transaction() IS
'Trigger function on pathway_credit_transactions. Not callable directly; updates profiles.credits inside a guarded mutation window.';

COMMENT ON FUNCTION public.award_credits_on_claim() IS
'Trigger function on task_claims. Not callable directly.';

COMMENT ON FUNCTION public.award_credits_on_verify() IS
'Trigger function on user_tasks. Not callable directly.';

COMMENT ON FUNCTION public.deduct_credits_on_redemption() IS
'Trigger function on redemptions. Not callable directly.';

COMMENT ON FUNCTION public.handle_new_user() IS
'Trigger on auth.users insert. Not callable directly; creates the matching profile and default role.';

COMMENT ON FUNCTION public.sync_profile_is_admin() IS
'Trigger on user_roles. Not callable directly; keeps profiles.is_admin in sync with admin role membership.';

COMMENT ON FUNCTION public.profiles_guard_privileged_columns() IS
'Trigger on profiles. Not callable directly; blocks participants from editing privileged columns (credits, is_admin, case_manager_id, email).';

COMMENT ON FUNCTION public.task_claims_block_self_verify() IS
'Trigger on task_claims. Not callable directly; prevents participants from self-verifying their own claims.';

COMMENT ON FUNCTION public.user_tasks_block_self_verify() IS
'Trigger on user_tasks. Not callable directly; prevents participants from self-verifying their own tasks.';
