import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { calcularJornada, formatarDuracaoJornada, getCargaDiaria, type Marcacao } from '@/lib/jornada';
import { fetchBancoHorasEntries, summarizeBancoHoras, formatMinutosHoras } from '@/lib/banco-horas';
import { getFeriadoComLocais } from '@/lib/feriados';
import { usePaywall } from '@/hooks/usePaywall';
import ProGate from '@/components/ProGate';
import { Clock, TrendingUp, Wallet, PiggyBank, Calendar } from 'lucide-react';

const MonthSummaryCard: React.FC = () => {
  const { user, profile } = useAuth();
  const { canSeeMoney } = usePaywall();
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [bancoSaldo, setBancoSaldo] = useState(0);
  const [feriadosLocais, setFeriadosLocais] = useState<{ data: string; nome: string; recorrente: boolean }[]>([]);

  const p = profile as any;
  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );
  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;

  const fetchData = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];

    const [marcRes, feriadosRes] = await Promise.all([
      supabase.from('marcacoes_ponto').select('*').eq('user_id', user.id)
        .is('deleted_at', null).gte('data', start).lte('data', end)
        .order('horario', { ascending: true }),
      supabase.from('feriados_locais').select('data, nome, recorrente').eq('user_id', user.id),
    ]);
    setMarcacoes((marcRes.data as Marcacao[]) || []);
    setFeriadosLocais((feriadosRes.data as any[]) || []);

    // Banco de horas
    const entries = await fetchBancoHorasEntries(user.id);
    const s = summarizeBancoHoras(entries, salario, percentual);
    const saldoInicial = p?.banco_horas_saldo_inicial ?? 0;
    const { data: comps } = await supabase.from('compensacoes_banco_horas' as any)
      .select('minutos').eq('user_id', user.id);
    const totalComp = (comps as any[] || []).reduce((acc: number, c: any) => acc + c.minutos, 0);
    setBancoSaldo(saldoInicial + s.saldo - totalComp);
  }, [user, profile, salario, percentual]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const map = new Map<string, Marcacao[]>();
    marcacoes.forEach(m => {
      if (!map.has(m.data)) map.set(m.data, []);
      map.get(m.data)!.push(m);
    });

    let totalMin = 0;
    let extraMin = 0;
    let diasTrab = 0;

    map.forEach((marks, data) => {
      const feriado = getFeriadoComLocais(data, feriadosLocais);
      const dateObj = new Date(data + 'T12:00:00');
      const ehFds = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const ehDiaLivre = !!feriado || ehFds;
      const cargaDoDia = ehDiaLivre ? 0 : carga * 60;

      const j = calcularJornada(marks, cargaDoDia);
      totalMin += j.totalTrabalhado;
      extraMin += j.horaExtraMin;
      diasTrab++;
    });

    const valorHN = salario > 0 ? salario / 220 : 0;
    const valorHE = valorHN * (1 + percentual / 100);
    const estimativaExtra = (extraMin / 60) * valorHE;
    const estimativaTotal = salario + estimativaExtra;

    return { totalMin, extraMin, diasTrab, estimativaExtra, estimativaTotal, valorHN, valorHE };
  }, [marcacoes, carga, salario, percentual, feriadosLocais]);

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, s => s.toUpperCase());

  return (
    <div className="space-y-3 animate-fade-in">
      <p className="text-xs font-semibold text-muted-foreground px-1 flex items-center gap-1.5">
        <Calendar size={12} />
        RESUMO DE {mesNome.toUpperCase()}
      </p>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total trabalhado */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-accent" />
            <p className="text-[10px] text-muted-foreground uppercase">Trabalhado</p>
          </div>
          <p className="text-lg font-bold">
            {stats.totalMin > 0 ? formatarDuracaoJornada(stats.totalMin) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">{stats.diasTrab} dias registrados</p>
        </div>

        {/* Horas extras */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-warning" />
            <p className="text-[10px] text-muted-foreground uppercase">Horas extras</p>
          </div>
          <p className={`text-lg font-bold ${stats.extraMin > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
            {stats.extraMin > 0 ? `+${formatarDuracaoJornada(stats.extraMin)}` : '—'}
          </p>
        </div>

        {/* Banco de horas */}
        {p?.modo_trabalho === 'banco_horas' && (
          <div className={`rounded-xl p-4 border ${bancoSaldo >= 0 ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <PiggyBank size={12} className={bancoSaldo >= 0 ? 'text-success' : 'text-destructive'} />
              <p className="text-[10px] text-muted-foreground uppercase">Banco de horas</p>
            </div>
            <p className={`text-lg font-bold ${bancoSaldo >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatMinutosHoras(bancoSaldo)}
            </p>
          </div>
        )}

        {/* Estimativa financeira */}
        <ProGate action="money" blurred estimatedValue={stats.estimativaTotal}>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={12} className="text-accent" />
              <p className="text-[10px] text-muted-foreground uppercase">Estimativa do mês</p>
            </div>
            <p className="text-lg font-bold text-accent">
              {stats.estimativaTotal > 0 ? formatCurrency(stats.estimativaTotal) : '—'}
            </p>
          </div>
        </ProGate>
      </div>

      {/* Financial breakdown */}
      {canSeeMoney && salario > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Estimativa financeira</p>
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Salário base</span>
              <span className="font-medium">{formatCurrency(salario)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor hora normal</span>
              <span className="font-medium">{formatCurrency(stats.valorHN)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor hora extra ({percentual}%)</span>
              <span className="font-medium">{formatCurrency(stats.valorHE)}</span>
            </div>
            <div className="border-t border-border pt-1.5 mt-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas extras</span>
                <span className="font-medium text-warning">
                  {stats.estimativaExtra > 0 ? `+ ${formatCurrency(stats.estimativaExtra)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-semibold">Total estimado</span>
                <span className="font-bold text-accent">{formatCurrency(stats.estimativaTotal)}</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-2">
            Valores estimados com base nos dados informados pelo usuário.
          </p>
        </div>
      )}
    </div>
  );
};

export default MonthSummaryCard;
