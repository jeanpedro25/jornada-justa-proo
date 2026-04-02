import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { mesAnoAtual, diaSemanaAbrev } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Palmtree } from 'lucide-react';
import ManualEntry from '@/components/ManualEntry';
import EditMarcacoesDia from '@/components/EditMarcacoesDia';
import {
  calcularJornada, calcularHoraExtra, formatarDuracaoJornada,
  formatarHoraLocal, getCargaDiaria, type Marcacao,
} from '@/lib/jornada';

type FilterPeriod = 'week' | 'month' | 'prev_month' | 'custom';

interface DaySummary {
  data: string;
  marcacoes: Marcacao[];
  totalMin: number;
  extraHours: number;
  intervaloMin: number;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  ferias?: boolean;
}

const HistoricoPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [allMarcacoes, setAllMarcacoes] = useState<Marcacao[]>([]);
  const [feriasDias, setFeriasDias] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const p = profile as any;
  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );

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

  const fetchMarcacoes = useCallback(async () => {
    if (!user) return;
    const { start, end } = getDateRange(filter);
    const [marcRes, feriasRes] = await Promise.all([
      supabase
        .from('marcacoes_ponto')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('data', start)
        .lte('data', end)
        .order('horario', { ascending: true }),
      supabase
        .from('ferias')
        .select('data_inicio, data_fim, status')
        .eq('user_id', user.id)
        .in('status', ['ativa', 'agendada', 'concluida']),
    ]);
    setAllMarcacoes((marcRes.data as Marcacao[]) || []);

    // Build set of vacation days within range
    const dias = new Set<string>();
    (feriasRes.data || []).forEach((f: any) => {
      let d = new Date(f.data_inicio + 'T12:00:00');
      const fim = new Date(f.data_fim + 'T12:00:00');
      while (d <= fim) {
        const ds = d.toISOString().split('T')[0];
        if (ds >= start && ds <= end) dias.add(ds);
        d.setDate(d.getDate() + 1);
      }
    });
    setFeriasDias(dias);
  }, [user, filter, dataInicio, dataFim]);

  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchMarcacoes(); }, [fetchMarcacoes]);

  const daySummaries: DaySummary[] = useMemo(() => {
    const map = new Map<string, Marcacao[]>();
    allMarcacoes.forEach(m => {
      if (!map.has(m.data)) map.set(m.data, []);
      map.get(m.data)!.push(m);
    });

    const summaries: DaySummary[] = [];
    map.forEach((marcacoes, data) => {
      const jornada = calcularJornada(marcacoes);
      const extra = calcularHoraExtra(jornada.totalTrabalhado, carga);
      summaries.push({
        data,
        marcacoes,
        totalMin: jornada.totalTrabalhado,
        extraHours: extra,
        intervaloMin: jornada.totalIntervalo,
        primeiraEntrada: jornada.primeiraEntrada,
        ultimaSaida: jornada.ultimaSaida,
        ferias: feriasDias.has(data),
      });
    });

    // Add vacation-only days (no marcações)
    feriasDias.forEach(data => {
      if (!map.has(data)) {
        summaries.push({
          data,
          marcacoes: [],
          totalMin: 0,
          extraHours: 0,
          intervaloMin: 0,
          primeiraEntrada: null,
          ultimaSaida: null,
          ferias: true,
        });
      }
    });

    return summaries.sort((a, b) => b.data.localeCompare(a.data));
  }, [allMarcacoes, carga, feriasDias]);

  const totalHoras = daySummaries.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = daySummaries.reduce((s, d) => s + d.extraHours, 0);

  const getDayStyle = (day: DaySummary) => {
    if (day.ferias) {
      return { bg: 'bg-card border-border', badge: 'bg-accent/20 text-accent' };
    }
    if (day.totalMin / 60 > 10) {
      return { bg: 'bg-card border-border', badge: 'bg-destructive/20 text-destructive' };
    }
    if (day.extraHours > 0) {
      return { bg: 'bg-card border-border', badge: 'bg-warning/20 text-warning' };
    }
    return { bg: 'bg-card border-border', badge: 'bg-success/20 text-success' };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Histórico de jornada" subtitle={mesAnoAtual()} />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">total trabalhado</p>
            <p className="text-lg font-bold">{totalHoras.toFixed(1)}h</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">horas extras</p>
            <p className={`text-lg font-bold ${totalExtra > 0 ? 'text-warning' : ''}`}>
              {totalExtra > 0 ? `${totalExtra.toFixed(1)}h` : '—'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {([['week', 'Esta semana'], ['month', 'Este mês'], ['prev_month', 'Mês anterior'], ['custom', 'Personalizado']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === key ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {filter === 'custom' && (
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block">De</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="rounded-xl h-9 text-xs" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground mb-1 block">Até</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="rounded-xl h-9 text-xs" />
            </div>
          </div>
        )}

        {/* Manual entry - only in histórico */}
        <ManualEntry onAdded={fetchMarcacoes} />

        {/* Day list */}
        {daySummaries.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum registro neste período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {daySummaries.map((day) => {
              const date = new Date(day.data + 'T12:00:00');
              const style = getDayStyle(day);

              return (
                <button key={day.data} onClick={() => setSelectedDay(day.data)}
                  className={`w-full rounded-xl p-4 border text-left hover:bg-secondary/50 transition-colors ${style.bg}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${style.badge}`}>
                      {diaSemanaAbrev(date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatarHoraLocal(day.primeiraEntrada)} → {formatarHoraLocal(day.ultimaSaida)}
                        {' · '}{formatarDuracaoJornada(day.totalMin)}
                        {day.intervaloMin > 0 && ` · intervalo ${formatarDuracaoJornada(day.intervaloMin)}`}
                      </p>
                    </div>
                    {day.extraHours > 0 && (
                      <span className="text-xs font-bold text-warning">+{day.extraHours.toFixed(1)}h</span>
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
        onSaved={fetchMarcacoes}
      />

      <BottomNav />
    </div>
  );
};

export default HistoricoPage;
