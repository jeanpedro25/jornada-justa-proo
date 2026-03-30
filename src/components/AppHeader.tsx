import React from 'react';
import { formatDatePtBR } from '@/lib/formatters';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title, subtitle }) => {
  const now = new Date();
  const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  return (
    <header className="bg-primary text-primary-foreground px-4 py-4 pb-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{title || 'Hora Justa'}</h1>
          <span className="bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full">
            {dias[now.getDay()]}
          </span>
        </div>
        <p className="text-sm opacity-70 mt-1">
          {subtitle || formatDatePtBR(now)}
        </p>
      </div>
    </header>
  );
};

export default AppHeader;
