-- Plano anual + campos Mercado Pago / assinatura PRO
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plano_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plano_check
  CHECK (plano IS NULL OR plano IN ('free', 'pro', 'anual'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano_vencimento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';

COMMENT ON COLUMN public.profiles.is_pro IS 'Acesso PRO ativo (espelha pagamento ou concessão manual)';
COMMENT ON COLUMN public.profiles.subscription_status IS 'inactive | active | trial — complementar ao plano';
