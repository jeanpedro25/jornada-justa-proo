ALTER TABLE public.marcacoes_ponto DROP CONSTRAINT marcacoes_ponto_origem_check;
ALTER TABLE public.marcacoes_ponto ADD CONSTRAINT marcacoes_ponto_origem_check 
  CHECK (origem = ANY (ARRAY['botao'::text, 'manual'::text, 'correcao'::text, 'importacao_automatica'::text]));