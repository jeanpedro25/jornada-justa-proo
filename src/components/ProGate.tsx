import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import PaywallModal from './PaywallModal';
import { usePaywall } from '@/hooks/usePaywall';

interface ProGateProps {
  children: React.ReactNode;
  action: 'money' | 'pdf' | 'history' | 'simulate';
  estimatedValue?: number;
  fallback?: React.ReactNode;
  blurred?: boolean;
}

const ProGate: React.FC<ProGateProps> = ({ children, action, estimatedValue, fallback, blurred }) => {
  const { shouldShowPaywall } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);

  if (!shouldShowPaywall(action)) {
    return <>{children}</>;
  }

  if (blurred) {
    return (
      <>
        <div className="relative cursor-pointer" onClick={() => setShowPaywall(true)}>
          <div className="blur-md select-none pointer-events-none">{children}</div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-xl">
            <Lock size={20} className="text-accent mb-1" />
            <span className="text-xs font-semibold text-accent">Desbloquear</span>
          </div>
        </div>
        <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={estimatedValue} trigger={action} />
      </>
    );
  }

  if (fallback) {
    return (
      <>
        <div onClick={() => setShowPaywall(true)} className="cursor-pointer">{fallback}</div>
        <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={estimatedValue} trigger={action} />
      </>
    );
  }

  return (
    <>
      <div onClick={() => setShowPaywall(true)} className="cursor-pointer">{children}</div>
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={estimatedValue} trigger={action} />
    </>
  );
};

export default ProGate;
