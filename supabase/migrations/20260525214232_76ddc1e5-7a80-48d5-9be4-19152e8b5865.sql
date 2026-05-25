REVOKE EXECUTE ON FUNCTION public.award_credits_on_claim() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_credits_on_verify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits_on_redemption() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
