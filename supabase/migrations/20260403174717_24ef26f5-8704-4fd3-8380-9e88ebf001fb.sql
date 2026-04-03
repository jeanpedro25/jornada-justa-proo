ALTER TABLE public.profiles
  ADD COLUMN dia_fechamento_folha integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.profiles.dia_fechamento_folha IS '0 = mês civil (dia 1-31). Qualquer outro valor (1-28) = dia de corte da folha.';