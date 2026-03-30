
-- Add columns for manual editing and file attachments
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS anexo_url text,
  ADD COLUMN IF NOT EXISTS editado_manualmente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS editado_por uuid;

-- Create storage bucket for atestados
INSERT INTO storage.buckets (id, name, public)
VALUES ('atestados', 'atestados', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload their own files
CREATE POLICY "Users can upload atestados"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'atestados' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: users can view their own files
CREATE POLICY "Users can view own atestados"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'atestados' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: users can delete their own files
CREATE POLICY "Users can delete own atestados"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'atestados' AND (storage.foldername(name))[1] = auth.uid()::text);
