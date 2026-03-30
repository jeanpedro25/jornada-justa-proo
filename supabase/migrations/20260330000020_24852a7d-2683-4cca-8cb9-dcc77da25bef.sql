
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
