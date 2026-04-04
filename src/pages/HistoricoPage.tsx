import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { mesAnoAtual, diaSemanaAbrev } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, TrendingUp, AlertTriangle, Palmtree, PartyPopper, Moon } from 'lucide-react';
import ManualEntry from '@/components/ManualEntry';
import EditMarcacoesDia from '@/components/EditMarcacoesDia';
import { getFeriadoComLocais } from '@/lib/feriados';
import {
  calcularJornada, formatarDuracaoJornada,
  formatarHoraLocal, getCargaDiaria, type Marcacao,
} from '@/lib/jornada';

type FilterPeriod = 'week' | 'month' | 'prev_month' | 'custom';
type DayStatus = 'registrado' | 'pendente' | 'ferias' | 'compensado' | 'fimdesemana' | 'feriado' | 'em_andamento' | 'atestado';
type QuickFilter = 'todos' | 'pendentes' | 'ferias' | 'extras' | 'atestados';

interface FeriasInfo {
  data_inicio: string;
  data_fim: string;
  status: string;
  tipo: string | null;
}

interface CompensacaoInfo {
  data: string;
  minutos: number;
  observacao: string | null;
}

interface DaySummary {
  data: string;
  diaSemana: number;
  status: DayStatus;
  marcacoes: Marcacao[];
  totalMin: number;
  extraHours: number;
  devendoMin: number;
  intervaloMin: number;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  feriasInfo: FeriasInfo | null;
  compensacao: CompensacaoInfo | null;
  feriadoNome: string | null;
  ehHoje: boolean;
  atestadoPeriodo: string | null;
}

const HistoricoPage: React.FC = () => {
  const formatLocalDate = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [allMarcacoes, setAllMarcacoes] = useState<Marcacao[]>([]);
  const [feriasDias, setFeriasDias] = useState<Map<string, FeriasInfo>>(new Map());
  const [compensacoes, setCompensacoes] = useState<Map<string, CompensacaoInfo>>(new Map());
  const [atestados, setAtestados] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [showWeekends, setShowWeekends] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [feriadosLocais, setFeriadosLocais] = useState<{ data: string; nome: string; recorrente: boolean }[]>([]);

  const p = profile as any;
  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );
  const dataCriacaoContaStr = user?.created_at
    ? formatLocalDate(user.created_at)
    : p?.created_at
      ? formatLocalDate(p.created_at)
      : null;

  const getDateRange = (period: FilterPeriod) => {
    const now = new Date();
    if (period === 'custom' && dataInicio && dataFim) return { start: dataInicio, end: dataFim };
    if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    if (period === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { start, end } = getDateRange(filter);
    const [marcRes, feriasRes, compRes, feriadosLocaisRes, atestadoRes] = await Promise.all([
      supabase.from('marcacoes_ponto').select('*').eq('user_id', user.id)
        .is('deleted_at', null).neq('origem', 'importacao_automatica')
        .gte('data', start).lte('data', end)
        .order('horario', { ascending: true }),
      supabase.from('ferias').select('data_inicio, data_fim, status, tipo')
        .eq('user_id', user.id).in('status', ['ativa', 'agendada', 'concluida']),
      supabase.from('compensacoes_banco_horas').select('*')
        .eq('user_id', user.id).gte('data', start).lte('data', end),
      supabase.from('feriados_locais').select('data, nome, recorrente')
        .eq('user_id', user.id),
      supabase.from('registros_ponto').select('data, atestado_periodo, anexo_url')
        .eq('user_id', user.id).gte('data', start).lte('data', end)
        .is('deleted_at', null)
        .not('anexo_url', 'is', null),
    ]);
    setAllMarcacoes((marcRes.data as Marcacao[]) || []);

    const dias = new Map<string, FeriasInfo>();
    (feriasRes.data || []).forEach((f: any) => {
      const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
      const fInicio = new Date(f.data_inicio + 'T12:00:00');
      const fFim = new Date(f.data_fim + 'T12:00:00');
      let autoStatus = f.status;
      if (hoje > fFim) autoStatus = 'concluida';
      else if (hoje >= fInicio && hoje <= fFim) autoStatus = 'ativa';
      else if (hoje < fInicio) autoStatus = 'agendada';
      let d = new Date(f.data_inicio + 'T12:00:00');
      while (d <= fFim) {
        const ds = d.toISOString().split('T')[0];
        if (ds >= start && ds <= end) {
          dias.set(ds, { data_inicio: f.data_inicio, data_fim: f.data_fim, status: autoStatus, tipo: f.tipo });
        }
        d.setDate(d.getDate() + 1);
      }
    });
    setFeriasDias(dias);

    const compMap = new Map<string, CompensacaoInfo>();
    (compRes.data || []).forEach((c: any) => {
      compMap.set(c.data, { data: c.data, minutos: c.minutos, observacao: c.observacao });
    });
    setCompensacoes(compMap);
    setFeriadosLocais((feriadosLocaisRes.data as any[]) || []);

    const atestMap = new Map<string, string>();
    (atestadoRes.data || []).forEach((a: any) => {
      if (a.anexo_url) atestMap.set(a.data, a.atestado_periodo || 'integral');
    });
    setAtestados(atestMap);
  }, [user, filter, dataInicio, dataFim]);

  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hojeStr = formatLocalDate(new Date());

  const daySummaries: DaySummary[] = useMemo(() => {
    const { start, end } = getDateRange(filter);
    const dataInicialVisivel = dataCriacaoContaStr && dataCriacaoContaStr > start ? dataCriacaoContaStr : start;

    if (dataInicialVisivel > end) return [];

    const marcMap = new Map<string, Marcacao[]>();
    allMarcacoes.forEach(m => {
      if (!marcMap.has(m.data)) marcMap.set(m.data, []);
      marcMap.get(m.data)!.push(m);
    });

    const summaries: DaySummary[] = [];
    const allDays: string[] = [];
    const cursor = new Date(dataInicialVisivel + 'T12:00:00');
    const endDate = new Date(end + 'T12:00:00');

    while (cursor <= endDate) {
      allDays.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    allDays.forEach((dataStr) => {
      const d = new Date(dataStr + 'T12:00:00');
      const diaSemana = d.getDay();
      const ehFds = diaSemana === 0 || diaSemana === 6;
      const ehHoje = dataStr === hojeStr;
      const marcacoes = marcMap.get(dataStr) || [];
      const feriasInfo = feriasDias.get(dataStr) || null;
      const compensacao = compensacoes.get(dataStr) || null;
      const feriado = getFeriadoComLocais(dataStr, feriadosLocais);

      if (dataStr > hojeStr) return;

      const ehDiaLivre = !!feriado || !!feriasInfo || ehFds;
      const cargaDoDia = ehDiaLivre ? 0 : carga * 60;

      let status: DayStatus;
      if (feriado && marcacoes.length === 0) {
        status = 'feriado';
      } else if (feriasInfo && marcacoes.length === 0) {
        status = 'ferias';
      } else if (compensacao) {
        status = 'compensado';
      } else if (ehFds && marcacoes.length === 0) {
        status = 'fimdesemana';
      } else if (marcacoes.length > 0) {
        const jornada = calcularJornada(marcacoes, cargaDoDia);
        if (jornada.emAndamento && ehHoje) {
          status = 'em_andamento';
        } else {
          status = feriado ? 'feriado' : 'registrado';
        }
      } else if (!ehFds) {
        status = 'pendente';
      } else {
        return;
      }

      const jornada = marcacoes.length > 0 ? calcularJornada(marcacoes, cargaDoDia) : null;

      // Atestado médico reduz/zera o "devendo"
      const atestadoPeriodo = atestados.get(dataStr);
      let devendoFinal = jornada?.devendoMin ?? 0;
      if (atestadoPeriodo) {
        if (atestadoPeriodo === 'integral') {
          devendoFinal = 0;
        } else if (atestadoPeriodo === 'manha' || atestadoPeriodo === 'tarde') {
          devendoFinal = Math.max(0, devendoFinal - Math.floor(cargaDoDia / 2));
        }
        // Day with atestado should show as 'atestado' status
        if (atestadoPeriodo === 'integral' && (status === 'pendente' || status === 'registrado')) {
          status = 'atestado';
        } else if ((atestadoPeriodo === 'manha' || atestadoPeriodo === 'tarde') && status === 'pendente') {
          status = 'atestado';
        }
      }

      summaries.push({
        data: dataStr,
        diaSemana,
        status,
        marcacoes,
        totalMin: jornada?.totalTrabalhado ?? 0,
        extraHours: (jornada?.horaExtraMin ?? 0) / 60,
        devendoMin: devendoFinal,
        intervaloMin: jornada?.totalIntervalo ?? 0,
        primeiraEntrada: jornada?.primeiraEntrada ?? null,
        ultimaSaida: jornada?.ultimaSaida ?? null,
        feriasInfo,
        compensacao,
        feriadoNome: feriado?.nome ?? null,
        ehHoje,
        atestadoPeriodo: atestadoPeriodo || null,
      });
    });

    return summaries.reverse();
  }, [allMarcacoes, carga, dataCriacaoContaStr, feriasDias, compensacoes, atestados, feriadosLocais, filter, dataInicio, dataFim, hojeStr]);

  // Apply quick filter
  const filteredDays = useMemo(() => {
    let days = daySummaries;
    if (!showWeekends) {
      days = days.filter(d => d.status !== 'fimdesemana' || d.ehHoje);
    }
    if (quickFilter === 'pendentes') return days.filter(d => d.status === 'pendente');
    if (quickFilter === 'ferias') return days.filter(d => d.status === 'ferias' || d.status === 'feriado');
    if (quickFilter === 'extras') return days.filter(d => d.extraHours > 0);
    if (quickFilter === 'atestados') return days.filter(d => d.status === 'atestado' || d.atestadoPeriodo);
    return days;
  }, [daySummaries, quickFilter, showWeekends]);

  // Stats
  const diasComRegistro = daySummaries.filter(d => d.marcacoes.length > 0);
  const totalHoras = diasComRegistro.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = diasComRegistro.reduce((s, d) => s + d.extraHours, 0);
  const diasTrabalhados = diasComRegistro.length;
  const diasPendentes = daySummaries.filter(d => d.status === 'pendente').length;

  const getStatusStyle = (day: DaySummary) => {
    switch (day.status) {
      case 'feriado': return { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', label: 'Feriado' };
      case 'ferias': return { bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Férias' };
      case 'compensado': return { bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Compensado' };
      case 'fimdesemana': return { bg: 'bg-muted/50 border-border', badge: 'bg-muted text-muted-foreground', label: 'Fim de semana' };
      case 'pendente': return { bg: 'bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Pendente' };
      case 'atestado': return { bg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300', label: 'Atestado' };
      case 'em_andamento': return { bg: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', label: 'Em andamento' };
      default: {
        if (day.extraHours > 0) return { bg: 'bg-card border-border', badge: 'bg-warning/20 text-warning', label: '' };
        return { bg: 'bg-card border-border', badge: 'bg-success/20 text-success', label: '' };
      }
    }
  };

  const handleDayClick = (day: DaySummary) => {
    if (day.status === 'fimdesemana' && day.marcacoes.length === 0) return;
    if (day.ehHoje && (day.status === 'pendente' || day.status === 'em_andamento')) {
      navigate('/app');
      return;
    }
    setSelectedDay(day.data);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Histórico de jornada" subtitle={mesAnoAtual()} />
      <div className="px-4 pt-3 max-w-lg mx-auto space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 animate-slide-up">
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <Clock size={14} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">trabalhado</p>
            <p className="text-sm font-bold">{formatarDuracaoJornada(Math.round(totalHoras * 60))}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <TrendingUp size={14} className="mx-auto text-warning mb-1" />
            <p className="text-[10px] text-muted-foreground">extras</p>
            <p className={`text-sm font-bold ${totalExtra > 0 ? 'text-warning' : ''}`}>
              {totalExtra > 0 ? `+${formatarDuracaoJornada(Math.round(totalExtra * 60))}` : '—'}
            </p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border text-center">
            <Calendar size={14} className="mx-auto text-accent mb-1" />
            <p className="text-[10px] text-muted-foreground">dias</p>
            <p className="text-sm font-bold">{diasTrabalhados}</p>
          </div>
        </div>

        {/* Pending days warning */}
        {diasPendentes > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2 animate-fade-in">
            <AlertTriangle size={14} className="text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              <strong>{diasPendentes} {diasPendentes === 1 ? 'dia pendente' : 'dias pendentes'}</strong> este mês
            </p>
            <button onClick={() => setQuickFilter('pendentes')} className="ml-auto text-[10px] text-orange-600 dark:text-orange-400 font-medium underline">
              Ver
            </button>
          </div>
        )}

        {/* Period filters */}
        <div className="flex gap-2 flex-wrap animate-fade-in">
          {([['week', 'Semana'], ['month', 'Mês'], ['prev_month', 'Anterior'], ['custom', 'Período']] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setQuickFilter('todos'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {label}
            </button>
          ))}
        </div>

        {filter === 'custom' && (
          <div className="flex gap-2 items-center animate-slide-up">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block">De</label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="rounded-xl h-9 text-xs" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block">Até</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="rounded-xl h-9 text-xs" />
            </div>
          </div>
        )}

        {/* Quick filters + weekend toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {([['todos', 'Todos'], ['pendentes', 'Pendentes'], ['ferias', 'Férias'], ['extras', 'Com extra'], ['atestados', 'Atestados']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setQuickFilter(key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${quickFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => setShowWeekends(!showWeekends)}
            className={`ml-auto px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${showWeekends ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            👁 FDS
          </button>
        </div>

        {/* Manual entry */}
        <ManualEntry onAdded={fetchData} />

        {/* Day list */}
        {filteredDays.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={28} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium mb-1">Nenhum registro neste período</p>
            <p className="text-xs text-muted-foreground/60">Use o botão acima para adicionar registros manuais</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDays.map((day, idx) => {
              const date = new Date(day.data + 'T12:00:00');
              const style = getStatusStyle(day);

              return (
                <button key={day.data} onClick={() => handleDayClick(day)}
                  className={`w-full rounded-xl p-3.5 border text-left transition-all hover:shadow-sm active:scale-[0.99] ${style.bg} animate-slide-up ${day.status === 'fimdesemana' ? 'opacity-60' : ''}`}
                  style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                  <div className="flex items-start gap-3">
                    {/* Day badge */}
                    <div className={`text-[10px] font-bold px-2 py-1.5 rounded-lg min-w-[36px] text-center shrink-0 ${style.badge}`}>
                      {day.status === 'ferias' ? '🏖' : day.status === 'feriado' ? '🎉' : day.status === 'compensado' ? '💤' : day.status === 'fimdesemana' ? '📅' : day.status === 'atestado' ? '🏥' : diaSemanaAbrev(date)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold tabular-nums">
                          {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </p>
                        {day.ehHoje && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">HOJE</span>
                        )}
                      </div>

                      {/* Status-specific content */}
                      {day.status === 'feriado' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{day.feriadoNome}</p>
                      )}

                      {day.status === 'ferias' && (
                        <div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {day.feriasInfo?.status === 'agendada' ? '📅 Férias agendadas' : '🏖 Férias'}
                          </p>
                          {day.feriasInfo && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(day.feriasInfo.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – {new Date(day.feriasInfo.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      )}

                      {day.status === 'compensado' && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Folga do banco de horas · {formatarDuracaoJornada(day.compensacao?.minutos ?? 0)} descontadas
                        </p>
                      )}

                      {day.status === 'fimdesemana' && (
                        <p className="text-[10px] text-muted-foreground">Fim de semana</p>
                      )}

                      {day.status === 'pendente' && (
                        <div>
                          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                            {day.ehHoje ? 'Você ainda não registrou hoje' : 'Nenhum registro neste dia'}
                          </p>
                          <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-0.5 font-medium">
                            {day.ehHoje ? '▶ Ir para o ponto' : '+ Adicionar registro'}
                          </p>
                        </div>
                      )}

                      {day.status === 'em_andamento' && (
                        <div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatarHoraLocal(day.primeiraEntrada)} → ... · ⏱ em andamento
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Ver no Ponto</p>
                        </div>
                      )}

                      {day.status === 'registrado' && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatarHoraLocal(day.primeiraEntrada)} → {formatarHoraLocal(day.ultimaSaida)}
                          {' · '}{formatarDuracaoJornada(day.totalMin)}
                          {day.intervaloMin > 0 && ` · ⏱${formatarDuracaoJornada(day.intervaloMin)}`}
                        </p>
                      )}
                    </div>

                    {/* Right badge */}
                    {(day.status === 'pendente' || day.status === 'em_andamento' || day.status === 'ferias' || day.status === 'feriado' || day.status === 'compensado' || day.status === 'fimdesemana') && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>
                    )}
                    {day.status === 'registrado' && day.extraHours > 0 && (
                      <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full shrink-0">
                        +{formatarDuracaoJornada(Math.round(day.extraHours * 60))}
                      </span>
                    )}
                    {day.status === 'registrado' && day.devendoMin > 0 && day.extraHours <= 0 && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full shrink-0">
                        -{formatarDuracaoJornada(day.devendoMin)} devendo
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <EditMarcacoesDia
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        data={selectedDay}
        onSaved={fetchData}
      />

      <BottomNav />
    </div>
  );
};

export default HistoricoPage;
