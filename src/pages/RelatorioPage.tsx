import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Lock, FileText, Shield, TrendingUp } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

const RelatorioPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    supabase
      .from('registros_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('data', start)
      .lte('data', end)
      .then(({ data }) => setRegistros(data || []));
  }, [user]);

  const carga = profile?.carga_horaria_diaria ?? 8;
  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;

  const totalHoras = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    return sum + calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
  }, 0);

  const totalExtra = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    return sum + calcHoraExtra(ht, carga);
  }, 0);

  const valorHE = calcValorHoraExtra(salario, percentual);
  const valorTotal = totalExtra * valorHE;

  const diasExcessivos = registros.filter((r) => {
    if (!r.saida) return false;
    return calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60) > 10;
  }).length;

  const irregularidades = registros.filter((r) => {
    if (!r.saida) return false;
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    return ht > 10 || (r.intervalo_minutos ?? 60) < 60;
  }).length;

  const isPro = profile?.plano === 'pro';

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Relatório oficial" subtitle="Gerar prova para advogado" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Preview Card */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} />
            <span className="font-semibold text-sm">Resumo do mês</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-60 text-xs">Total trabalhado</p>
              <p className="font-bold">{totalHoras.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Horas extras</p>
              <p className="font-bold text-accent">{totalExtra.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">O patrão te deve</p>
              <p className="font-bold text-accent">{formatCurrency(valorTotal)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Dias &gt; 10h</p>
              <p className="font-bold">{diasExcessivos}</p>
            </div>
          </div>
          {irregularidades > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠ {irregularidades} irregularidade{irregularidades > 1 ? 's' : ''} encontrada{irregularidades > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Download / Upgrade */}
        {isPro ? (
          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold">
            Baixar PDF oficial
          </Button>
        ) : (
          <div className="space-y-4">
            <Button disabled className="w-full rounded-xl h-12 font-semibold opacity-50">
              Baixar PDF oficial
            </Button>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={18} className="text-warning" />
                <span className="font-bold">Sua prova jurídica está aqui</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li className="flex items-center gap-2">
                  <Shield size={14} className="text-accent" />
                  PDF oficial com todos os registros
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent" />
                  Cálculo automático de horas extras e valores
                </li>
                <li className="flex items-center gap-2">
                  <FileText size={14} className="text-accent" />
                  Pronto para entregar ao advogado
                </li>
              </ul>
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold">
                Assinar Pro — R$ 9,90/mês
              </Button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default RelatorioPage;
