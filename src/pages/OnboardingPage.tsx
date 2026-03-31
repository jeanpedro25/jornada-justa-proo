import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

const OnboardingPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [salario, setSalario] = useState('');
  const [carga, setCarga] = useState<number | null>(null);
  const [cargaCustom, setCargaCustom] = useState('');
  const [percentual, setPercentual] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const progress = (step / 4) * 100;

  const canAdvance = () => {
    if (step === 1) return nome.trim().length > 0;
    if (step === 2) return salario.trim().length > 0 && Number(salario) > 0;
    if (step === 3) return carga !== null;
    if (step === 4) return percentual !== null;
    return false;
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    const cargaFinal = carga || Number(cargaCustom);
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: nome.trim(),
        salario_base: Number(salario),
        carga_horaria_diaria: cargaFinal,
        hora_extra_percentual: percentual!,
        onboarding_completo: true,
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Tudo certo!', description: 'Seu perfil foi configurado.' });
      navigate('/app');
    }
    setLoading(false);
  };

  const next = () => {
    if (step < 4) setStep(step + 1);
    else handleFinish();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-primary-foreground text-lg font-bold">Configurar perfil</h1>
          <p className="text-primary-foreground/60 text-sm">Passo {step} de 4</p>
          <Progress value={progress} className="mt-3 h-2" />
        </div>
      </div>

      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Como você quer ser chamado?</h2>
            <Input
              placeholder="Seu nome ou apelido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-xl h-12 text-base"
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Qual é o seu salário mensal?</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
              <Input
                type="number"
                placeholder="0,00"
                value={salario}
                onChange={(e) => setSalario(e.target.value)}
                className="rounded-xl h-12 text-base pl-10"
                min={0}
                step="0.01"
                autoFocus
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Quantas horas você trabalha por dia?</h2>
            <div className="grid grid-cols-3 gap-3">
              {[6, 7, '7h30', 8, '8h30', 9, 10, 12].map((h) => {
                const valor = typeof h === 'string' ? parseFloat(h.replace('h', '.').replace('30', '5')) : h;
                const label = typeof h === 'string' ? h : `${h}h`;
                return (
                  <button
                    key={label}
                    onClick={() => { setCarga(valor); setCargaCustom(''); }}
                    className={`py-3 rounded-xl border-2 font-semibold transition-colors ${
                      carga === valor
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Qual é o seu adicional de hora extra?</h2>
            <div className="space-y-3">
              <button
                onClick={() => setPercentual(50)}
                className={`w-full py-4 rounded-xl border-2 text-left px-4 transition-colors ${
                  percentual === 50
                    ? 'border-accent bg-accent/10'
                    : 'border-border'
                }`}
              >
                <span className="font-semibold">50%</span>
                <span className="text-sm text-muted-foreground ml-2">dias úteis</span>
              </button>
              <button
                onClick={() => setPercentual(100)}
                className={`w-full py-4 rounded-xl border-2 text-left px-4 transition-colors ${
                  percentual === 100
                    ? 'border-accent bg-accent/10'
                    : 'border-border'
                }`}
              >
                <span className="font-semibold">100%</span>
                <span className="text-sm text-muted-foreground ml-2">domingos/feriados</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl h-12">
              Voltar
            </Button>
          )}
          <Button
            onClick={next}
            disabled={!canAdvance() || loading}
            className="flex-1 bg-primary text-primary-foreground rounded-xl h-12 text-base font-semibold"
          >
            {loading ? 'Salvando...' : step === 4 ? 'Finalizar' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
