import React from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Shield } from 'lucide-react';

const PrivacidadePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Privacidade" subtitle="Seus dados, suas regras" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-accent" />
            <span className="font-semibold">Política de Privacidade</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Hora Justa armazena apenas os dados que você mesmo insere.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seus dados não são compartilhados com terceiros.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você pode exportar ou deletar seus dados a qualquer momento em Configurações.
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default PrivacidadePage;
