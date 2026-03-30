CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.alertas WHERE user_id = auth.uid();
  DELETE FROM public.registros_ponto_historico WHERE registro_id IN (SELECT id FROM public.registros_ponto WHERE user_id = auth.uid());
  DELETE FROM public.registros_ponto WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;