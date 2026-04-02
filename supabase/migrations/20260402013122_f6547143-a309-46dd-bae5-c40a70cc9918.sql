
CREATE TABLE IF NOT EXISTS public.ferias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  dias_direito INTEGER DEFAULT 30,
  tipo TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'agendada',
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ferias" ON public.ferias
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ferias_user ON public.ferias(user_id, data_inicio DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_admissao DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento_ferias DATE;
