import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type PlanoStatus = 'pro' | 'anual' | 'trial' | 'expirado';

export interface PlanoInfo {
  status: PlanoStatus;
  isPro: boolean;        // tem plano pago ativo
  isTrial: boolean;      // está no período trial de 7 dias
  isExpirado: boolean;   // trial venceu, sem plano pago
  diasRestantesTrial: number;
  podeUsarPro: boolean;  // isPro || isTrial
}

const TRIAL_DIAS = 7;

export function usePlano(): PlanoInfo {
  const { profile } = useAuth();

  return useMemo(() => {
    const agora = new Date();

    // Plano pago ativo
    const planoPago = profile?.plano === 'pro' || profile?.plano === 'anual';
    const vencimento = (profile as any)?.plano_vencimento
      ? new Date((profile as any).plano_vencimento)
      : null;
    const planoAtivo = planoPago && (!vencimento || vencimento > agora);

    if (planoAtivo) {
      return {
        status: profile!.plano as PlanoStatus,
        isPro: true,
        isTrial: false,
        isExpirado: false,
        diasRestantesTrial: 0,
        podeUsarPro: true,
      };
    }

    // Trial: baseia-se em created_at do perfil
    const criadoEm = (profile as any)?.created_at
      ? new Date((profile as any).created_at)
      : null;

    if (criadoEm) {
      const diffMs = agora.getTime() - criadoEm.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diasRestantesTrial = Math.max(0, TRIAL_DIAS - diffDias);
      const estaNoTrial = diasRestantesTrial > 0;

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

    // Expirado
    return {
      status: 'expirado',
      isPro: false,
      isTrial: false,
      isExpirado: true,
      diasRestantesTrial: 0,
      podeUsarPro: false,
    };
  }, [profile]);
}
