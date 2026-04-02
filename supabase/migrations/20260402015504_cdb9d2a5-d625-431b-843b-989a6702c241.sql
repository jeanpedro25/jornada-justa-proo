
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banco_horas_saldo_inicial INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco_horas_saldo_inicial_data DATE;

CREATE TABLE IF NOT EXISTS public.compensacoes_banco_horas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  minutos INTEGER NOT NULL,
  tipo TEXT DEFAULT 'dia_completo',
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.compensacoes_banco_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_compensacoes" ON public.compensacoes_banco_horas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
