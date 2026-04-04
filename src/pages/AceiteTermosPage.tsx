import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import HoraJustaLogo from '@/components/HoraJustaLogo';

const AceiteTermosPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [aceito, setAceito] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinuar = async () => {
    if (!user || !aceito) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ aceite_termos: true } as never)
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      navigate('/onboarding');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center flex flex-col items-center">
          <HoraJustaLogo size={56} />
          <h1 className="text-xl font-bold mt-2">Antes de começar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Para usar o Hora Justa, é necessário aceitar nossos termos.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="aceite"
              checked={aceito}
              onCheckedChange={(v) => setAceito(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="aceite" className="text-sm leading-relaxed cursor-pointer">
              Li e concordo com os{' '}
              <button
                type="button"
                onClick={() => navigate('/termos')}
                className="text-accent underline font-medium"
              >
                Termos de Uso
              </button>{' '}
              e a{' '}
              <button
                type="button"
                onClick={() => navigate('/privacidade-publica')}
                className="text-accent underline font-medium"
              >
                Política de Privacidade
              </button>
            </label>
          </div>

          <Button
            onClick={handleContinuar}
            disabled={!aceito || loading}
            className="w-full rounded-xl h-12 text-base font-semibold"
          >
            {loading ? 'Salvando...' : 'Continuar'}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center">
          Os registros são de responsabilidade do usuário. Valores são estimativas.
        </p>
      </div>
    </div>
  );
};

export default AceiteTermosPage;
