import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import HoraJustaLogo from '@/components/HoraJustaLogo';

const LandingNav: React.FC = () => {
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
        <HoraJustaLogo size={36} showText />
        <div className="hidden md:flex items-center gap-6">
          <button onClick={() => scrollTo('problema')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Direitos</button>
          <button onClick={() => scrollTo('simulador')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Calculadora</button>
          <button onClick={() => scrollTo('precos')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Planos</button>
        </div>
        <Button
          className="rounded-xl bg-gradient-to-r from-primary to-accent-container text-primary-foreground font-semibold text-sm px-6 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all hover:-translate-y-0.5"
          onClick={() => navigate('/auth')}
        >
          Começar Agora
        </Button>
      </div>
      <div className="h-px bg-surface-low" />
    </nav>
  );
};

export default LandingNav;
