-- 1. Make atestados bucket private
UPDATE storage.buckets SET public = false WHERE id = 'atestados';

-- 2. Drop existing public-role policies and recreate as deny for historico UPDATE/DELETE
DROP POLICY IF EXISTS "No one can update historico" ON public.registros_ponto_historico;
DROP POLICY IF EXISTS "No one can delete historico" ON public.registros_ponto_historico;

CREATE POLICY "No one can update historico"
ON public.registros_ponto_historico
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No one can delete historico"
ON public.registros_ponto_historico
FOR DELETE
TO authenticated
USING (false);

-- 3. Fix all RLS policies from public to authenticated role

-- registros_ponto
ALTER POLICY "Users can insert own registros" ON public.registros_ponto TO authenticated;
ALTER POLICY "Users can update own registros" ON public.registros_ponto TO authenticated;
ALTER POLICY "Users can view own registros" ON public.registros_ponto TO authenticated;

-- registros_ponto_historico
ALTER POLICY "Users can insert own historico" ON public.registros_ponto_historico TO authenticated;
ALTER POLICY "Users can view own historico" ON public.registros_ponto_historico TO authenticated;

-- alertas
ALTER POLICY "Users can insert own alertas" ON public.alertas TO authenticated;
ALTER POLICY "Users can update own alertas" ON public.alertas TO authenticated;
ALTER POLICY "Users can view own alertas" ON public.alertas TO authenticated;

-- profiles
ALTER POLICY "Users can insert own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can update own profile" ON public.profiles TO authenticated;
ALTER POLICY "Users can view own profile" ON public.profiles TO authenticated;