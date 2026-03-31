import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export const usePaywall = () => {
  const { profile } = useAuth();

  return useMemo(() => {
    const isPro = profile?.plano === 'pro' || profile?.plano === 'anual';
    const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date();
    const daysUsed = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000));

    return {
      isPro,
      daysUsed,
      canSeeMoney: isPro,
      canExportPdf: isPro,
      canSeeFullHistory: isPro,
      canSimulateValue: isPro,
      shouldShowPaywall: (action: 'money' | 'pdf' | 'history' | 'simulate' | 'auto') => {
        if (isPro) return false;
        if (action === 'auto') return daysUsed >= 2;
        return true;
      },
    };
  }, [profile]);
};
