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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors relative ${
                active ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
              {path === '/historico' && unreadAlerts > 0 && (
                <span className="absolute -top-1 right-0 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
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
