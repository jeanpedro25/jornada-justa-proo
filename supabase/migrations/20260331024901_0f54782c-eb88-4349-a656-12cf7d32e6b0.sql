
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
