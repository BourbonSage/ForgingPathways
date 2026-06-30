CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_user_id uuid DEFAULT NULL::uuid,
  p_details jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'partner'::app_role)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), p_action, p_target_user_id, p_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;