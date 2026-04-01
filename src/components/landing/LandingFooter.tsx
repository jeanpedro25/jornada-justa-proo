import React from 'react';
import { useNavigate } from 'react-router-dom';
import HoraJustaLogo from '@/components/HoraJustaLogo';

const LandingFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-surface-low py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <HoraJustaLogo size={28} showText />
        <div className="flex gap-6 text-sm">
          <button onClick={() => navigate('/termos')} className="text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 decoration-accent-container">
            Termos de Uso
          </button>
          <button onClick={() => navigate('/privacidade-publica')} className="text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 decoration-accent-container">
            Privacidade
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center md:text-right">
          © {new Date().getFullYear()} Hora Justa. Ferramenta de Controle de Jornada.
        </p>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-4">
        Os registros são de responsabilidade do usuário. Valores são estimativas baseadas nos dados informados.
      </p>
    </footer>
  );
};

export default LandingFooter;
