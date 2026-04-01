import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { mesAnoAtual, diaSemanaAbrev } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import EditRegistroDia from '@/components/EditRegistroDia';

type FilterPeriod = 'week' | 'month' | 'prev_month' | 'custom';

interface DaySummary {
  id: string;
  data: string;
  manha_estado: string;
  tarde_estado: string;
  manha_entrada: string | null;
  manha_saida: string | null;
  manha_atestado_url: string | null;
  tarde_entrada: string | null;
  tarde_saida: string | null;
  tarde_atestado_url: string | null;
  intervalo_minutos: number | null;
  observacao: string | null;
  editado_manualmente: boolean;
  totalMin: number;
  extraHours: number;
}

const HistoricoPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedReg, setSelectedReg] = useState<DaySummary | null>(null);

  const carga = (profile as any)?.carga_horaria_diaria ?? 8;

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

  const fetchRegistros = useCallback(async () => {
    if (!user) return;
    const { start, end } = getDateRange(filter);
    const { data } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('data', start)
      .lte('data', end)
      .order('data', { ascending: false });
    setRegistros(data || []);
  }, [user, filter, dataInicio, dataFim]);

  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const horaParaMin = (t: string | null): number => {
    if (!t) return 0;
    const clean = t.includes(':') ? t.substring(0, 5) : t;
    const [h, m] = clean.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const daySummaries: DaySummary[] = React.useMemo(() => {
    // Group by data - take first row per day (new structure = 1 row/day)
    const map = new Map<string, any>();
    registros.forEach(r => { if (!map.has(r.data)) map.set(r.data, r); });

    return Array.from(map.values()).map(r => {
      let totalMin = 0;
      const manhaEstado = r.manha_estado || 'pendente';
      const tardeEstado = r.tarde_estado || 'pendente';

      if (manhaEstado === 'registrado' && r.manha_entrada && r.manha_saida) {
        totalMin += horaParaMin(r.manha_saida) - horaParaMin(r.manha_entrada);
      }
      if (tardeEstado === 'registrado' && r.tarde_entrada && r.tarde_saida) {
        totalMin += horaParaMin(r.tarde_saida) - horaParaMin(r.tarde_entrada);
      }

      // Subtract interval
      const intervalo = r.intervalo_minutos ?? 60;
      if (manhaEstado === 'registrado' && tardeEstado === 'registrado') {
        totalMin -= intervalo;
      }
      totalMin = Math.max(0, totalMin);

      // Hora extra
      const temAtestadoParcial = (manhaEstado === 'atestado') !== (tardeEstado === 'atestado');
      const ambosAtestado = manhaEstado === 'atestado' && tardeEstado === 'atestado';
      const cargaEsperada = ambosAtestado ? 0 : (temAtestadoParcial ? carga / 2 : carga);
      const extraHours = cargaEsperada > 0 ? Math.max(0, totalMin / 60 - cargaEsperada) : 0;

      return {
        id: r.id,
        data: r.data,
        manha_estado: manhaEstado,
        tarde_estado: tardeEstado,
        manha_entrada: r.manha_entrada,
        manha_saida: r.manha_saida,
        manha_atestado_url: r.manha_atestado_url,
        tarde_entrada: r.tarde_entrada,
        tarde_saida: r.tarde_saida,
        tarde_atestado_url: r.tarde_atestado_url,
        intervalo_minutos: r.intervalo_minutos,
        observacao: r.observacao,
        editado_manualmente: r.editado_manualmente,
        totalMin,
        extraHours,
      };
    });
  }, [registros, carga]);

  const totalHoras = daySummaries.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = daySummaries.reduce((s, d) => s + d.extraHours, 0);

  const getDayStyle = (day: DaySummary) => {
    const m = day.manha_estado;
    const t = day.tarde_estado;

    if (m === 'atestado' || t === 'atestado') {
      return { bg: 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    }
    if (m === 'pendente' || t === 'pendente') {
      return { bg: 'bg-warning/5 border-warning/30', badge: 'bg-warning/20 text-warning' };
    }
    if (day.totalMin / 60 > 10) {
      return { bg: 'bg-card border-border', badge: 'bg-destructive/20 text-destructive' };
    }
    if (day.extraHours > 0) {
      return { bg: 'bg-card border-border', badge: 'bg-warning/20 text-warning' };
    }
    return { bg: 'bg-card border-border', badge: 'bg-success/20 text-success' };
  };

  const getPendingLabel = (day: DaySummary) => {
    if (day.manha_estado === 'pendente' && day.tarde_estado === 'pendente') return 'Nenhum período registrado';
    if (day.manha_estado === 'pendente') return 'Período manhã não registrado';
    if (day.tarde_estado === 'pendente') return 'Período tarde não registrado';
    return null;
  };

  const formatTimeStr = (t: string | null) => {
    if (!t) return '';
    return t.substring(0, 5);
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
              const pending = getPendingLabel(day);
              const hasAtestado = day.manha_estado === 'atestado' || day.tarde_estado === 'atestado';

              return (
                <button key={day.data} onClick={() => setSelectedReg(day)}
                  className={`w-full rounded-xl p-4 border text-left hover:bg-secondary/50 transition-colors ${style.bg}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${style.badge}`}>
                      {diaSemanaAbrev(date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1">
                        {hasAtestado && '🏥 '}
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        {day.editado_manualmente && <span className="text-[10px] text-warning">✏️</span>}
                      </p>

                      {hasAtestado && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 inline-block mt-0.5 mb-1">
                          {day.manha_estado === 'atestado' && day.tarde_estado === 'atestado'
                            ? 'Atestado integral'
                            : day.manha_estado === 'atestado' ? 'Atestado manhã' : 'Atestado tarde'}
                        </span>
                      )}

                      {/* Period summaries */}
                      {day.manha_estado === 'atestado' ? (
                        <p className="text-xs text-blue-500 italic">🌅 Coberto por atestado</p>
                      ) : day.manha_estado === 'registrado' ? (
                        <p className="text-xs text-muted-foreground">🌅 {formatTimeStr(day.manha_entrada)} → {formatTimeStr(day.manha_saida)}</p>
                      ) : null}

                      {day.tarde_estado === 'atestado' ? (
                        <p className="text-xs text-blue-500 italic">🌇 Coberto por atestado</p>
                      ) : day.tarde_estado === 'registrado' ? (
                        <p className="text-xs text-muted-foreground">🌇 {formatTimeStr(day.tarde_entrada)} → {formatTimeStr(day.tarde_saida)}</p>
                      ) : null}

                      {pending && (
                        <p className="text-[10px] text-warning mt-0.5">⚠️ {pending} · 👉 Toque para ajustar</p>
                      )}
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

      <EditRegistroDia
        open={!!selectedReg}
        onClose={() => setSelectedReg(null)}
        registro={selectedReg}
        onSaved={fetchRegistros}
      />

      <BottomNav />
    </div>
  );
};

export default HistoricoPage;
