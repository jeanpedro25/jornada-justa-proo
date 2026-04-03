
CREATE TABLE public.feriados_locais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  recorrente BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feriados_locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_feriados_locais" ON public.feriados_locais
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
