
CREATE OR REPLACE FUNCTION public.redeem_passcode(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_passcode RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_passcode
  FROM public.one_time_passcodes
  WHERE code = _code
    AND used_at IS NULL
    AND expires_at > now()
    AND (email IS NULL OR lower(email) = lower(v_user_email))
  LIMIT 1;

  IF v_passcode.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, v_passcode.intended_role);

  UPDATE public.one_time_passcodes
    SET used_at = now(), used_by = v_user_id
    WHERE id = v_passcode.id;

  RETURN jsonb_build_object('ok', true, 'role', v_passcode.intended_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_passcode(text) TO authenticated;
