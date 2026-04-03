ALTER TABLE public.profiles
  ADD COLUMN vale_alimentacao numeric NOT NULL DEFAULT 0,
  ADD COLUMN auxilio_combustivel numeric NOT NULL DEFAULT 0,
  ADD COLUMN bonificacoes numeric NOT NULL DEFAULT 0,
  ADD COLUMN plano_saude numeric NOT NULL DEFAULT 0,
  ADD COLUMN adiantamentos numeric NOT NULL DEFAULT 0,
  ADD COLUMN outros_descontos_detalhados numeric NOT NULL DEFAULT 0;