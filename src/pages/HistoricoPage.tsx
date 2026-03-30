import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatTime, formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra, diaSemanaAbrev, mesAnoAtual } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

type FilterPeriod = 'week' | 'month' | 'prev_month';

const HistoricoPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [selected, setSelected] = useState<Registro | null>(null);
  const [editEntrada, setEditEntrada] = useState('');
  const [editSaida, setEditSaida] = useState('');
  const [editIntervalo, setEditIntervalo] = useState('');
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  const getDateRange = (period: FilterPeriod) => {
    const now = new Date();
    if (period === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
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
  }, [user, filter]);

  // Mark alerts as read
  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const totalHoras = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    return sum + calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
  }, 0);

  const totalExtra = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    return sum + calcHoraExtra(ht, profile?.carga_horaria_diaria ?? 8);
  }, 0);

  const openEdit = (r: Registro) => {
    setSelected(r);
    setEditEntrada(new Date(r.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setEditSaida(r.saida ? new Date(r.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
    setEditIntervalo(String(r.intervalo_minutos ?? 60));
    setEditObs(r.observacao || '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);

    // Save history
    const changes: Array<{ registro_id: string; campo_alterado: string; valor_anterior: string; valor_novo: string }> = [];
    const currentEntrada = formatTime(new Date(selected.entrada));
    if (editEntrada !== currentEntrada) {
      changes.push({ registro_id: selected.id, campo_alterado: 'entrada', valor_anterior: currentEntrada, valor_novo: editEntrada });
    }
    const currentSaida = selected.saida ? formatTime(new Date(selected.saida)) : '';
    if (editSaida !== currentSaida) {
      changes.push({ registro_id: selected.id, campo_alterado: 'saida', valor_anterior: currentSaida, valor_novo: editSaida });
    }
    if (String(selected.intervalo_minutos ?? 60) !== editIntervalo) {
      changes.push({ registro_id: selected.id, campo_alterado: 'intervalo_minutos', valor_anterior: String(selected.intervalo_minutos ?? 60), valor_novo: editIntervalo });
    }

    if (changes.length > 0) {
      await supabase.from('registros_ponto_historico').insert(changes);
    }

    // Parse times back to full timestamps
    const baseDate = selected.data;
    const parseTime = (timeStr: string, base: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(`${base}T00:00:00`);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    const updateData: any = {
      intervalo_minutos: Number(editIntervalo),
      observacao: editObs || null,
    };
    if (editEntrada) updateData.entrada = parseTime(editEntrada, baseDate);
    if (editSaida) updateData.saida = parseTime(editSaida, baseDate);

    const { error } = await supabase.from('registros_ponto').update(updateData).eq('id', selected.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro atualizado!' });
      fetchRegistros();
    }
    setSelected(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase.from('registros_ponto').update({ deleted_at: new Date().toISOString() }).eq('id', selected.id);
    toast({ title: 'Registro removido' });
    fetchRegistros();
    setSelected(null);
    setSaving(false);
  };

  const getBadgeColor = (r: Registro) => {
    if (!r.saida) return 'bg-muted text-muted-foreground';
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    const he = calcHoraExtra(ht, profile?.carga_horaria_diaria ?? 8);
    if (ht > 10 || he > 2) return 'bg-destructive/20 text-destructive';
    if (he > 0) return 'bg-warning/20 text-warning';
    return 'bg-success/20 text-success';
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
        <div className="flex gap-2">
          {([['week', 'Esta semana'], ['month', 'Este mês'], ['prev_month', 'Mês anterior']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {registros.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum registro neste período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {registros.map((r) => {
              const ht = r.saida ? calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60) : 0;
              const he = r.saida ? calcHoraExtra(ht, profile?.carga_horaria_diaria ?? 8) : 0;
              const date = new Date(r.data + 'T12:00:00');
              return (
                <button
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className="w-full bg-card rounded-xl p-4 border border-border text-left flex items-center gap-3 hover:bg-secondary/50 transition-colors"
                >
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getBadgeColor(r)}`}>
                    {diaSemanaAbrev(date)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(new Date(r.entrada))}
                      {r.saida ? ` — ${formatTime(new Date(r.saida))}` : ' (aberto)'}
                      {' · '}{r.intervalo_minutos ?? 60}min intervalo
                    </p>
                  </div>
                  {he > 0 && (
                    <span className="text-xs font-bold text-warning">+{he.toFixed(1)}h</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Editar registro</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Entrada</label>
              <Input value={editEntrada} onChange={(e) => setEditEntrada(e.target.value)} placeholder="08:00" className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saída</label>
              <Input value={editSaida} onChange={(e) => setEditSaida(e.target.value)} placeholder="17:00" className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Intervalo (min)</label>
              <Input type="number" value={editIntervalo} onChange={(e) => setEditIntervalo(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Observação</label>
              <Input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Opcional" className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-primary text-primary-foreground">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button onClick={handleDelete} disabled={saving} variant="destructive" className="rounded-xl">
                Excluir
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
