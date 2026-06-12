
-- Secure redemption path: participants cannot insert ledger rows directly
-- anymore, so we expose a SECURITY DEFINER RPC that validates the amount
-- and writes the negative ledger entry on their behalf.
CREATE OR REPLACE FUNCTION public.redeem_reward(p_cost integer, p_title text)
RETURNS public.pathway_credit_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_ledger public.pathway_credit_transactions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RAISE EXCEPTION 'invalid_cost';
  END IF;

  SELECT COALESCE(credits, 0) INTO v_balance
    FROM public.profiles WHERE id = v_uid;
  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.pathway_credit_transactions (
    user_id, amount, type, description
  ) VALUES (
    v_uid, -p_cost, 'redeemed_reward',
    'Redeemed: ' || COALESCE(p_title, 'reward')
  ) RETURNING * INTO v_ledger;

  RETURN v_ledger;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(integer, text) TO authenticated;
