import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { usePlano } from './usePlano';

export const usePaywall = () => {
  const { profile } = useAuth();
  const plano = usePlano();

  return useMemo(() => {
    const { isPro, isTrial, podeUsarPro } = plano;

    return {
      isPro,
      isTrial,
      podeUsarPro,
      canSeeMoney: podeUsarPro,
      canExportPdf: podeUsarPro,
      canExportExcel: podeUsarPro,
      canSeeFullHistory: podeUsarPro,
      canSimulateValue: podeUsarPro,
      canUseRadar: podeUsarPro,
      shouldShowPaywall: (action: 'money' | 'pdf' | 'history' | 'simulate' | 'auto' | 'excel' | 'radar') => {
        if (podeUsarPro) return false;
        return true;
      },
    };
  }, [plano, profile]);
};
