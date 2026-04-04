CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.marcacoes_ponto WHERE user_id = auth.uid();
  DELETE FROM public.banco_horas WHERE user_id = auth.uid();
  DELETE FROM public.compensacoes_banco_horas WHERE user_id = auth.uid();
  DELETE FROM public.feriados_locais WHERE user_id = auth.uid();
  DELETE FROM public.ferias WHERE user_id = auth.uid();
  DELETE FROM public.alertas WHERE user_id = auth.uid();
  DELETE FROM public.registros_ponto_historico WHERE registro_id IN (SELECT id FROM public.registros_ponto WHERE user_id = auth.uid());
  DELETE FROM public.registros_ponto WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;