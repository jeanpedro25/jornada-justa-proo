-- Fix feriados_locais policy: change from public to authenticated
DROP POLICY IF EXISTS "users_own_feriados_locais" ON public.feriados_locais;

CREATE POLICY "users_own_feriados_locais" ON public.feriados_locais
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);