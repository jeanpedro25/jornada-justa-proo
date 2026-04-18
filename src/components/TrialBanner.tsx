import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlano } from '@/hooks/usePlano';
import { Zap, Clock, AlertTriangle } from 'lucide-react';

const TrialBanner: React.FC = () => {
  const navigate = useNavigate();
  const { isTrial, isExpirado, diasRestantesTrial } = usePlano();

  if (!isTrial && !isExpirado) return null;

  if (isExpirado) {
    return (
      <div
        onClick={() => navigate('/planos')}
        className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground text-xs font-semibold rounded-xl shadow-md animate-pulse"
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span>Período de teste encerrado — Assine para continuar usando os recursos PRO</span>
        <span className="ml-auto bg-white/20 rounded px-2 py-0.5 text-[10px]">Assinar →</span>
      </div>
    );
  }

  const urgente = diasRestantesTrial <= 2;

  return (
    <div
      onClick={() => navigate('/planos')}
      className={`cursor-pointer flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all ${
        urgente
          ? 'bg-orange-500 text-white'
          : 'bg-accent/15 text-accent border border-accent/30'
      }`}
    >
      <Clock size={13} className="shrink-0" />
      <span>
        {diasRestantesTrial === 1
          ? '⚠️ Último dia de teste gratuito!'
          : `🎁 Teste grátis: ${diasRestantesTrial} dias restantes`}
      </span>
      <span className={`ml-auto rounded px-2 py-0.5 text-[10px] ${urgente ? 'bg-white/20' : 'bg-accent/20'}`}>
        Assinar PRO →
      </span>
    </div>
  );
};

export default TrialBanner;
