-- Make atestados bucket private
UPDATE storage.buckets SET public = false WHERE id = 'atestados';

-- Deny UPDATE and DELETE on audit table
CREATE POLICY "No one can update historico"
ON public.registros_ponto_historico
FOR UPDATE
TO public
USING (false);

CREATE POLICY "No one can delete historico"
ON public.registros_ponto_historico
FOR DELETE
TO public
USING (false);