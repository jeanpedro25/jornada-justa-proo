import React, { useState, useEffect } from 'react';
import { formatDatePtBR } from '@/lib/formatters';
import HoraJustaLogo from '@/components/HoraJustaLogo';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title, subtitle }) => {
  const [now, setNow] = useState(() => new Date());
  const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="bg-primary text-primary-foreground px-4 sticky top-0 z-10"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      <div className="max-w-lg mx-auto flex flex-col gap-0.5 py-2.5">
        {/* Row 1: Logo + title + day badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HoraJustaLogo size={32} />
            <span className="text-lg font-semibold">{title || 'Hora Justa'}</span>
          </div>
          <span className="bg-accent/20 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full">
            {dias[now.getDay()]}
          </span>
        </div>

        {/* Row 2: Date + clock */}
        <div className="flex items-center justify-between">
          <p className="text-xs opacity-60">
            {subtitle || formatDatePtBR(now)}
          </p>
          <span className="text-xs opacity-80 font-mono tabular-nums">
            {timeStr}
          </span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
