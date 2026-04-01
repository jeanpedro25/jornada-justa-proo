
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS manha_entrada time;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS manha_saida time;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS manha_estado text DEFAULT 'pendente';
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS manha_atestado_url text;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS tarde_entrada time;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS tarde_saida time;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS tarde_estado text DEFAULT 'pendente';
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS tarde_atestado_url text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registros_ponto_manha_estado_check') THEN
    ALTER TABLE public.registros_ponto ADD CONSTRAINT registros_ponto_manha_estado_check CHECK (manha_estado IN ('pendente','registrado','atestado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registros_ponto_tarde_estado_check') THEN
    ALTER TABLE public.registros_ponto ADD CONSTRAINT registros_ponto_tarde_estado_check CHECK (tarde_estado IN ('pendente','registrado','atestado'));
  END IF;
END $$;
