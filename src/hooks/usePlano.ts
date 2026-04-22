import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type PlanoStatus = 'pro' | 'anual' | 'trial' | 'expirado';

export interface PlanoInfo {
  status: PlanoStatus;
  isPro: boolean;
  isTrial: boolean;
  isExpirado: boolean;
  diasRestantesTrial: number;
  /** Acesso irrestrito: plano pago ativo, flags no perfil, ou trial de 7 dias */
  podeUsarPro: boolean;
}

const TRIAL_DIAS = 7;

export function usePlano(): PlanoInfo {
  const { profile, user } = useAuth();

  return useMemo(() => {
    const agora = new Date();
    const rawVenc = (profile as { plano_vencimento?: string | null })?.plano_vencimento;
    const vencimento = rawVenc ? new Date(rawVenc) : null;
    const vencimentoValido = vencimento && !Number.isNaN(vencimento.getTime());
    const vencido = vencimentoValido && vencimento! <= agora;

    const planoId = profile?.plano;
    const ehPlanoPago = planoId === 'pro' || planoId === 'anual';
    const isProFlag = (profile as { is_pro?: boolean })?.is_pro === true;
    const subAtivo =
      String((profile as { subscription_status?: string | null })?.subscription_status || '')
        .toLowerCase() === 'active';

    const planoPagoAtivo = ehPlanoPago && (!vencimentoValido || vencimento! > agora);
    const flagsAtivas =
      (isProFlag || subAtivo) && (!vencimentoValido || vencimento! > agora);

    if (planoPagoAtivo || flagsAtivas) {
      const st: PlanoStatus =
        planoId === 'anual' ? 'anual' : planoId === 'pro' ? 'pro' : 'pro';
      return {
        status: st,
        isPro: true,
        isTrial: false,
        isExpirado: false,
        diasRestantesTrial: 0,
        podeUsarPro: true,
      };
    }

    if (vencido && ehPlanoPago) {
      // Plano expirado: não retém se ainda estiver em trial (calculado abaixo)
    }

    const criadoEmStr =
      profile?.created_at || user?.created_at || null;
    const criadoEm = criadoEmStr ? new Date(criadoEmStr) : null;

    if (criadoEm && !Number.isNaN(criadoEm.getTime())) {
      const diffMs = agora.getTime() - criadoEm.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diasRestantesTrial = Math.max(0, TRIAL_DIAS - diffDias);
      const isCancelled = String((profile as { subscription_status?: string | null })?.subscription_status || '').toLowerCase() === 'cancelled';
      const estaNoTrial = diasRestantesTrial > 0 && !isCancelled;

      if (estaNoTrial) {
        return {
          status: 'trial',
          isPro: false,
          isTrial: true,
          isExpirado: false,
          diasRestantesTrial,
          podeUsarPro: true,
        };
      }
    }

    return {
      status: 'expirado',
      isPro: false,
      isTrial: false,
      isExpirado: true,
      diasRestantesTrial: 0,
      podeUsarPro: false,
    };
  }, [profile, user]);
}
