
CREATE TABLE IF NOT EXISTS public.marcacoes_ponto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida_final')),
  horario TIMESTAMPTZ NOT NULL,
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('botao', 'manual', 'correcao')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marcacoes_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marcacoes" ON public.marcacoes_ponto
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marcacoes" ON public.marcacoes_ponto
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marcacoes" ON public.marcacoes_ponto
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_marcacoes_user_data ON public.marcacoes_ponto(user_id, data DESC);
