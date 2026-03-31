
-- Add banco de horas config to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS modo_trabalho text NOT NULL DEFAULT 'horas_extras',
  ADD COLUMN IF NOT EXISTS prazo_compensacao_dias integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS regra_conversao text NOT NULL DEFAULT '1.5x',
  ADD COLUMN IF NOT EXISTS limite_banco_horas integer;

-- Create banco_horas table
CREATE TABLE public.banco_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  tipo text NOT NULL,
  minutos integer NOT NULL,
  expira_em timestamptz NOT NULL,
  nota text,
  registro_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banco_horas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own banco_horas" ON public.banco_horas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own banco_horas" ON public.banco_horas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own banco_horas" ON public.banco_horas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own banco_horas" ON public.banco_horas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
