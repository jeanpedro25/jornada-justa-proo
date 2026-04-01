import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatTime, mesAnoAtual, diaSemanaAbrev } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { Calendar, Loader2 } from 'lucide-react';
import AttachFile from '@/components/AttachFile';
import type { AtestadoPeriodo } from '@/components/AttachFile';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;
type FilterPeriod = 'week' | 'month' | 'prev_month' | 'custom';

interface DayGroup {
  data: string;
  registros: Registro[];
  totalMin: number;
  extraHours: number;
  hasAnexo: boolean;
  editado: boolean;
  atestadoPeriodo: AtestadoPeriodo | null;
}

const HistoricoPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayGroup | null>(null);
  const [editFields, setEditFields] = useState<Array<{ id: string; entrada: string; saida: string }>>([]);
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  const carga = profile?.carga_horaria_diaria ?? 8;

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
      .order('data', { ascending: false })
      .order('created_at', { ascending: true });
    setRegistros(data || []);
  }, [user, filter, dataInicio, dataFim]);

  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const dayGroups: DayGroup[] = React.useMemo(() => {
    const map = new Map<string, Registro[]>();
    registros.forEach(r => {
      const existing = map.get(r.data) || [];
      existing.push(r);
      map.set(r.data, existing);
    });
    return Array.from(map.entries()).map(([data, regs]) => {
      const atestadoPeriodo = (regs[0] as any)?.atestado_periodo as AtestadoPeriodo | null;
      let totalMin = 0;
      regs.forEach((r, i) => {
        if (atestadoPeriodo === 'integral') return;
        if (atestadoPeriodo === 'manha' && i === 0) return;
        if (atestadoPeriodo === 'tarde' && i === 1) return;
        if (r.saida) {
          totalMin += (new Date(r.saida).getTime() - new Date(r.entrada).getTime()) / 60000;
        }
      });
      const totalHours = totalMin / 60;
      const cargaEfetiva = atestadoPeriodo === 'integral' ? 0 : (atestadoPeriodo ? carga / 2 : carga);
      return {
        data,
        registros: regs,
        totalMin,
        extraHours: cargaEfetiva > 0 ? Math.max(0, totalHours - cargaEfetiva) : 0,
        hasAnexo: regs.some(r => !!r.anexo_url),
        editado: regs.some(r => r.editado_manualmente),
        atestadoPeriodo,
      };
    });
  }, [registros, carga]);

  const totalHoras = dayGroups.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = dayGroups.reduce((s, d) => s + d.extraHours, 0);

  const openEdit = (day: DayGroup) => {
    setSelectedDay(day);
    setEditFields(day.registros.map(r => ({
      id: r.id,
      entrada: new Date(r.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      saida: r.saida ? new Date(r.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    })));
    setEditObs(day.registros[0]?.observacao || '');
  };

  const updateField = (index: number, field: 'entrada' | 'saida', value: string) => {
    setEditFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const handleSave = async () => {
    if (!selectedDay || !user) return;
    setSaving(true);
    for (let i = 0; i < editFields.length; i++) {
      const field = editFields[i];
      const original = selectedDay.registros[i];
      if (!original) continue;
      const baseDate = original.data;
      const parseTime = (timeStr: string) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date(`${baseDate}T00:00:00`); d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const updateData: any = {
        editado_manualmente: true, editado_em: new Date().toISOString(), editado_por: user.id,
        observacao: editObs || null,
      };
      const newEntrada = parseTime(field.entrada);
      const newSaida = parseTime(field.saida);
      if (newEntrada) updateData.entrada = newEntrada;
      if (newSaida) updateData.saida = newSaida;
      else if (!field.saida) updateData.saida = null;
      await supabase.from('registros_ponto').update(updateData).eq('id', original.id);
    }
    toast({ title: 'Registros atualizados!' });
    fetchRegistros();
    setSelectedDay(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedDay) return;
    setSaving(true);
    for (const r of selectedDay.registros) {
      await supabase.from('registros_ponto').update({ deleted_at: new Date().toISOString() }).eq('id', r.id);
    }
    toast({ title: 'Registros do dia removidos' });
    fetchRegistros();
    setSelectedDay(null);
    setSaving(false);
  };

  const getBadgeColor = (day: DayGroup) => {
    if (day.atestadoPeriodo) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (day.totalMin === 0) return 'bg-muted text-muted-foreground';
    const hours = day.totalMin / 60;
    if (hours > 10 || day.extraHours > 2) return 'bg-destructive/20 text-destructive';
    if (day.extraHours > 0) return 'bg-warning/20 text-warning';
    return 'bg-success/20 text-success';
  };

  const isFieldDisabled = (periodIndex: number) => {
    if (!selectedDay?.atestadoPeriodo) return false;
    if (selectedDay.atestadoPeriodo === 'integral') return true;
    if (selectedDay.atestadoPeriodo === 'manha' && periodIndex === 0) return true;
    if (selectedDay.atestadoPeriodo === 'tarde' && periodIndex === 1) return true;
    return false;
  };

  const atestadoLabel = (p: AtestadoPeriodo) =>
    p === 'manha' ? 'Atestado manhã' : p === 'tarde' ? 'Atestado tarde' : 'Atestado integral';

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
        {dayGroups.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum registro neste período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayGroups.map((day) => {
              const date = new Date(day.data + 'T12:00:00');
              return (
                <button key={day.data} onClick={() => openEdit(day)}
                  className={`w-full rounded-xl p-4 border text-left hover:bg-secondary/50 transition-colors ${
                    day.atestadoPeriodo ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900' : 'bg-card border-border'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getBadgeColor(day)}`}>
                      {diaSemanaAbrev(date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1">
                        {day.atestadoPeriodo && '🏥 '}
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        {day.editado && <span className="text-[10px] text-warning">✏️</span>}
                      </p>
                      {day.atestadoPeriodo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 inline-block mt-0.5 mb-1">
                          {atestadoLabel(day.atestadoPeriodo)}
                        </span>
                      )}
                      {day.registros.map((r, i) => {
                        const covered = day.atestadoPeriodo === 'integral' ||
                          (day.atestadoPeriodo === 'manha' && i === 0) ||
                          (day.atestadoPeriodo === 'tarde' && i === 1);
                        return (
                          <p key={r.id} className={`text-xs ${covered ? 'text-blue-500 italic' : 'text-muted-foreground'}`}>
                            {i === 0 ? '🌅' : '🌇'}{' '}
                            {covered ? 'Coberto por atestado' : (
                              <>
                                {formatTime(new Date(r.entrada))}
                                {r.saida ? ` → ${formatTime(new Date(r.saida))}` : ' (aberto)'}
                              </>
                            )}
                          </p>
                        );
                      })}
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

      {/* Edit Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar registro do dia</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {editFields.map((field, i) => {
              const disabled = isFieldDisabled(i);
              const periodLabel = i === 0 ? '🌅 Período manhã' : '🌇 Período tarde';

              if (disabled) {
                return (
                  <div key={field.id} className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 rounded-xl p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      🏥 {periodLabel}
                    </p>
                    <div className="mt-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg p-3">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Coberto por atestado médico</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={field.id}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{periodLabel}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Entrada</label>
                      <Input type="time" value={field.entrada} onChange={(e) => updateField(i, 'entrada', e.target.value)} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Saída</label>
                      <Input type="time" value={field.saida} onChange={(e) => updateField(i, 'saida', e.target.value)} className="rounded-xl" />
                    </div>
                  </div>
                </div>
              );
            })}

            <div>
              <label className="text-sm font-medium mb-1 block">Observação</label>
              <Input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Opcional" className="rounded-xl" />
            </div>

            {/* Atestado */}
            <AttachFile
              registroIds={selectedDay?.registros.map(r => r.id) || []}
              currentUrl={selectedDay?.registros[0]?.anexo_url || null}
              currentPeriodo={selectedDay?.atestadoPeriodo || null}
              onAttached={() => { fetchRegistros(); setSelectedDay(null); }}
              onRemoved={() => { fetchRegistros(); setSelectedDay(null); }}
            />

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-primary text-primary-foreground">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button onClick={handleDelete} disabled={saving} variant="destructive" className="rounded-xl">
                Excluir dia
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
};

export default HistoricoPage;
