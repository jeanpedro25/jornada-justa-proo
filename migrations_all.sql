
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT,
  salario_base NUMERIC DEFAULT 0,
  carga_horaria_diaria NUMERIC DEFAULT 8,
  hora_extra_percentual NUMERIC DEFAULT 50,
  plano TEXT DEFAULT 'free' CHECK (plano IN ('free', 'pro')),
  onboarding_completo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create registros_ponto table
CREATE TABLE public.registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  saida TIMESTAMPTZ,
  intervalo_minutos INTEGER DEFAULT 60,
  observacao TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own registros" ON public.registros_ponto FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registros" ON public.registros_ponto FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registros" ON public.registros_ponto FOR UPDATE USING (auth.uid() = user_id);

-- Create registros_ponto_historico table
CREATE TABLE public.registros_ponto_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id UUID NOT NULL REFERENCES public.registros_ponto(id) ON DELETE CASCADE,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.registros_ponto_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historico" ON public.registros_ponto_historico
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.registros_ponto rp WHERE rp.id = registro_id AND rp.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own historico" ON public.registros_ponto_historico
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.registros_ponto rp WHERE rp.id = registro_id AND rp.user_id = auth.uid())
  );

-- Create alertas table
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registro_id UUID NOT NULL REFERENCES public.registros_ponto(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('hora_extra', 'sem_intervalo', 'jornada_excessiva', 'intervalo_curto')),
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alertas" ON public.alertas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alertas" ON public.alertas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alertas" ON public.alertas FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_registros_ponto_user_data ON public.registros_ponto(user_id, data);
CREATE INDEX idx_alertas_user_lido ON public.alertas(user_id, lido);



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


ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intervalo_almoco integer NOT NULL DEFAULT 60;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.alertas WHERE user_id = auth.uid();
  DELETE FROM public.registros_ponto_historico WHERE registro_id IN (SELECT id FROM public.registros_ponto WHERE user_id = auth.uid());
  DELETE FROM public.registros_ponto WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;


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


ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aceite_termos boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles ADD COLUMN empresa text;


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_jornada text NOT NULL DEFAULT 'jornada_fixa',
  ADD COLUMN IF NOT EXISTS dias_trabalhados_semana integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS horario_entrada_padrao time,
  ADD COLUMN IF NOT EXISTS horario_saida_padrao time,
  ADD COLUMN IF NOT EXISTS escala_tipo text,
  ADD COLUMN IF NOT EXISTS escala_dias_trabalho integer,
  ADD COLUMN IF NOT EXISTS escala_dias_folga integer,
  ADD COLUMN IF NOT EXISTS escala_inicio date,
  ADD COLUMN IF NOT EXISTS turno_a_inicio time,
  ADD COLUMN IF NOT EXISTS turno_a_fim time,
  ADD COLUMN IF NOT EXISTS turno_b_inicio time,
  ADD COLUMN IF NOT EXISTS turno_b_fim time,
  ADD COLUMN IF NOT EXISTS turno_c_inicio time,
  ADD COLUMN IF NOT EXISTS turno_c_fim time,
  ADD COLUMN IF NOT EXISTS alternancia_turno text NOT NULL DEFAULT 'manual';


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

ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS atestado_periodo text;


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


-- Fix feriados_locais policy: change from public to authenticated
DROP POLICY IF EXISTS "users_own_feriados_locais" ON public.feriados_locais;

CREATE POLICY "users_own_feriados_locais" ON public.feriados_locais
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN descontos_fixos numeric NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN vale_alimentacao numeric NOT NULL DEFAULT 0,
  ADD COLUMN auxilio_combustivel numeric NOT NULL DEFAULT 0,
  ADD COLUMN bonificacoes numeric NOT NULL DEFAULT 0,
  ADD COLUMN plano_saude numeric NOT NULL DEFAULT 0,
  ADD COLUMN adiantamentos numeric NOT NULL DEFAULT 0,
  ADD COLUMN outros_descontos_detalhados numeric NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN dia_fechamento_folha integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.profiles.dia_fechamento_folha IS '0 = mês civil (dia 1-31). Qualquer outro valor (1-28) = dia de corte da folha.';

ALTER TABLE public.profiles ADD COLUMN hora_extra_percentual_feriado numeric DEFAULT 100;


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS historico_importado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS historico_inicio DATE;


CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.marcacoes_ponto WHERE user_id = auth.uid();
  DELETE FROM public.banco_horas WHERE user_id = auth.uid();
  DELETE FROM public.compensacoes_banco_horas WHERE user_id = auth.uid();
  DELETE FROM public.feriados_locais WHERE user_id = auth.uid();
  DELETE FROM public.ferias WHERE user_id = auth.uid();
  DELETE FROM public.alertas WHERE user_id = auth.uid();
  DELETE FROM public.registros_ponto_historico WHERE registro_id IN (SELECT id FROM public.registros_ponto WHERE user_id = auth.uid());
  DELETE FROM public.registros_ponto WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;

ALTER TABLE public.marcacoes_ponto DROP CONSTRAINT marcacoes_ponto_origem_check;
ALTER TABLE public.marcacoes_ponto ADD CONSTRAINT marcacoes_ponto_origem_check 
  CHECK (origem = ANY (ARRAY['botao'::text, 'manual'::text, 'correcao'::text, 'importacao_automatica'::text]));

