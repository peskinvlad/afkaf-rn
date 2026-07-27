-- Снимок от 15.07.2026. RPC. Гранты: REVOKE PUBLIC/anon, GRANT authenticated.
CREATE OR REPLACE FUNCTION public.get_friendship_status(other_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status    text;
  v_requester uuid;
BEGIN
  SELECT status, requester_id
  INTO v_status, v_requester
  FROM friendships
  WHERE (requester_id = auth.uid() AND addressee_id = other_user_id)
     OR (requester_id = other_user_id AND addressee_id = auth.uid())
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN 'none';
  ELSIF v_status = 'accepted' THEN
    RETURN 'friends';
  ELSIF v_status = 'pending' AND v_requester = auth.uid() THEN
    RETURN 'pending_sent';
  ELSIF v_status = 'pending' AND v_requester = other_user_id THEN
    RETURN 'pending_received';
  ELSE
    RETURN 'none';
  END IF;
END;
$function$;
