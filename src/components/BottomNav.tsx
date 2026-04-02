import React from 'react';
import { Clock, ClipboardList, FileText, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { icon: Clock, label: 'Ponto', path: '/app' },
  { icon: ClipboardList, label: 'Histórico', path: '/historico' },
  { icon: FileText, label: 'Relatório', path: '/relatorio' },
  { icon: Settings, label: 'Config', path: '/configuracoes' },
];

interface BottomNavProps {
  unreadAlerts?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ unreadAlerts = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 glass-card border-t border-border z-50 safe-bottom">
      <p className="text-[9px] text-muted-foreground/40 text-center pt-1 px-4">
        Os registros são de responsabilidade do usuário. Valores são estimativas.
      </p>
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 relative ${
                active
                  ? 'text-accent scale-105'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              }`}
            >
              {active && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-accent" />
              )}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              {path === '/historico' && unreadAlerts > 0 && (
                <span className="absolute -top-1 right-0 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-scale-in">
                  {unreadAlerts > 9 ? '9+' : unreadAlerts}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
