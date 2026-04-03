import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { calcularJornada, formatarDuracaoJornada, getCargaDiaria, type Marcacao } from '@/lib/jornada';
import { fetchBancoHorasEntries, summarizeBancoHoras, formatMinutosHoras } from '@/lib/banco-horas';
import { getFeriadoComLocais } from '@/lib/feriados';
import { calcularLiquido } from '@/lib/descontos';
import { usePaywall } from '@/hooks/usePaywall';
import ProGate from '@/components/ProGate';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Clock, TrendingUp, PiggyBank, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const MonthSummaryCard: React.FC = () => {
  const { user, profile } = useAuth();
  const { canSeeMoney } = usePaywall();
  const navigate = useNavigate();
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [bancoSaldo, setBancoSaldo] = useState(0);
  const [bancoUsado, setBancoUsado] = useState(0);
  const [feriadosLocais, setFeriadosLocais] = useState<{ data: string; nome: string; recorrente: boolean }[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const p = profile as any;
  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );
  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;
  const descontosFixos = (p?.descontos_fixos as number) ?? 0;
  const beneficios = {
    valeAlimentacao: (p?.vale_alimentacao as number) ?? 0,
    auxilioCombustivel: (p?.auxilio_combustivel as number) ?? 0,
    bonificacoes: (p?.bonificacoes as number) ?? 0,
  };
  const descontosDetalhados = {
    planoSaude: (p?.plano_saude as number) ?? 0,
    adiantamentos: (p?.adiantamentos as number) ?? 0,
    outrosDescontos: (p?.outros_descontos_detalhados as number) ?? 0,
  };

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

    const entries = await fetchBancoHorasEntries(user.id);
    const s = summarizeBancoHoras(entries, salario, percentual);
    const saldoInicial = p?.banco_horas_saldo_inicial ?? 0;
    const { data: comps } = await supabase.from('compensacoes_banco_horas' as any)
      .select('minutos').eq('user_id', user.id);
    const totalComp = (comps as any[] || []).reduce((acc: number, c: any) => acc + c.minutos, 0);
    setBancoSaldo(saldoInicial + s.saldo - totalComp);
    setBancoUsado(totalComp);
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
    const bruto = salario + estimativaExtra;

    const resumo = calcularLiquido(bruto, descontosFixos, beneficios, descontosDetalhados);

    return { totalMin, extraMin, diasTrab, estimativaExtra, bruto, valorHN, valorHE, resumo };
  }, [marcacoes, carga, salario, percentual, feriadosLocais, descontosFixos, beneficios, descontosDetalhados]);

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, s => s.toUpperCase());

  return (
    <div className="space-y-5 animate-fade-in">

      {/* === HERO: Salário líquido estimado === */}
      <ProGate action="money" blurred estimatedValue={stats.resumo.liquido}>
        <div className="text-center py-6">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Salário Líquido Estimado
          </p>
          <p className="text-3xl font-black text-accent tabular-nums tracking-tight leading-none">
            {stats.resumo.liquido > 0 ? formatCurrency(stats.resumo.liquido) : 'R$ 0,00'}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {mesNome}
          </p>
          {stats.estimativaExtra > 0 && canSeeMoney && (
            <p className="text-xs text-warning font-medium mt-1">
              +{formatCurrency(stats.estimativaExtra)} em horas extras (estimativa)
            </p>
          )}
        </div>
      </ProGate>

      {/* === Secondary: 2 columns === */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Clock size={13} className="text-accent" />
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Trabalhado</p>
          </div>
          <p className="text-lg font-bold">
            {stats.totalMin > 0 ? formatarDuracaoJornada(stats.totalMin) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">{stats.diasTrab} dias</p>
        </div>

        <ProGate action="money" blurred estimatedValue={stats.estimativaExtra}>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp size={13} className="text-warning" />
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Extras acumulados</p>
            </div>
            <p className={`text-lg font-bold ${stats.estimativaExtra > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {stats.estimativaExtra > 0 ? `+${formatCurrency(stats.estimativaExtra)}` : '—'}
            </p>
          </div>
        </ProGate>
      </div>

      {/* === Collapsible: Breakdown bruto → líquido === */}
      {canSeeMoney && salario > 0 && (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <span>Ver detalhes</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-card rounded-xl p-4 border border-border mt-2 space-y-2 animate-fade-in">
              <div className="text-xs space-y-1.5">
                {/* Bruto */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bruto</span>
                  <span className="font-medium">{formatCurrency(stats.bruto)}</span>
                </div>
                {/* INSS */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">(-) INSS estimado</span>
                  <span className="font-medium text-destructive">-{formatCurrency(stats.resumo.inss)}</span>
                </div>
                {/* IRRF */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">(-) IRRF estimado</span>
                  <span className="font-medium text-destructive">
                    {stats.resumo.irrf > 0 ? `-${formatCurrency(stats.resumo.irrf)}` : 'Isento'}
                  </span>
                </div>
                {/* Descontos fixos */}
                {descontosFixos > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">(-) Descontos fixos</span>
                    <span className="font-medium text-destructive">-{formatCurrency(descontosFixos)}</span>
                  </div>
                )}
                {/* Extras breakdown */}
                <div className="border-t border-border pt-1.5 mt-1.5" />
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total horas extras</span>
                  <span className="font-medium text-warning">
                    {stats.extraMin > 0 ? `+${formatarDuracaoJornada(stats.extraMin)}` : '—'}
                  </span>
                </div>
                {/* Total líquido */}
                <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
                  <span className="font-semibold">(=) Líquido estimado</span>
                  <span className="font-bold text-accent">{formatCurrency(stats.resumo.liquido)}</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* === Banco de horas === */}
      {p?.modo_trabalho === 'banco_horas' && (
        <div className={`rounded-xl p-4 border ${bancoSaldo >= 0 ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <PiggyBank size={14} className={bancoSaldo >= 0 ? 'text-success' : 'text-destructive'} />
            <p className="text-xs font-semibold">Banco de horas</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Saldo</p>
              <p className={`font-bold ${bancoSaldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatMinutosHoras(bancoSaldo)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Usado</p>
              <p className="font-bold">-{formatMinutosHoras(bancoUsado)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vencido</p>
              <p className="font-bold text-muted-foreground">—</p>
            </div>
          </div>
        </div>
      )}

      {/* === CTA Button === */}
      <Button
        variant="outline"
        className="w-full rounded-xl gap-2 border-accent/30 text-accent hover:bg-accent/10"
        onClick={() => navigate('/relatorio')}
      >
        <FileText size={16} />
        Gerar relatório profissional
      </Button>

      {/* === Legal disclaimer === */}
      <p className="text-[9px] text-muted-foreground/50 text-center px-4 leading-relaxed">
        Os descontos são estimativas baseadas na legislação geral. Valores reais de benefícios (VT, VR, Saúde) e descontos específicos da empresa devem ser conferidos no seu holerite oficial.
      </p>
    </div>
  );
};

export default MonthSummaryCard;
