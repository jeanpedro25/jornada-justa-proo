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
    <header className="bg-primary text-primary-foreground px-4 pt-5 pb-8 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent/10 pointer-events-none" />
      
      <div className="max-w-lg mx-auto flex flex-col items-center gap-3 relative z-10">
        {/* Logo + title row */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <HoraJustaLogo size={36} />
            <span className="text-lg font-bold">{title || 'Hora Justa'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <span className="bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full">
              {dias[now.getDay()]}
            </span>
          </div>
        </div>

        {/* Big real-time clock */}
        <div className="text-5xl font-extrabold tabular-nums tracking-tight font-mono animate-fade-in">
          {timeStr}
        </div>

        <p className="text-sm opacity-70">
          {subtitle || formatDatePtBR(now)}
        </p>
      </div>
    </header>
  );
};

export default AppHeader;
