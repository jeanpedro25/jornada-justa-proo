
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS historico_importado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS historico_inicio DATE;
