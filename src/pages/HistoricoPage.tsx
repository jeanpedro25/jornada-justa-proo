import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatTime, calcHorasTrabalhadas, calcHoraExtra, diaSemanaAbrev, mesAnoAtual } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { Calendar, Paperclip, Upload, Loader2, ExternalLink, Filter } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;
type FilterPeriod = 'week' | 'month' | 'prev_month';

interface DayGroup {
  data: string;
  registros: Registro[];
  totalMin: number;
  extraHours: number;
  hasAnexo: boolean;
  editado: boolean;
}

const HistoricoPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [filter, setFilter] = useState<FilterPeriod>('month');
  const [selectedDay, setSelectedDay] = useState<DayGroup | null>(null);
  const [editFields, setEditFields] = useState<Array<{ id: string; entrada: string; saida: string }>>([]);
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carga = profile?.carga_horaria_diaria ?? 8;

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
      .order('data', { ascending: false })
      .order('created_at', { ascending: true });
    setRegistros(data || []);
  }, [user, filter]);

  useEffect(() => {
    if (!user) return;
    supabase.from('alertas').update({ lido: true }).eq('user_id', user.id).eq('lido', false).then(() => {});
  }, [user]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Group records by day
  const dayGroups: DayGroup[] = React.useMemo(() => {
    const map = new Map<string, Registro[]>();
    registros.forEach(r => {
      const existing = map.get(r.data) || [];
      existing.push(r);
      map.set(r.data, existing);
    });
    return Array.from(map.entries()).map(([data, regs]) => {
      let totalMin = 0;
      regs.forEach(r => {
        if (r.saida) {
          totalMin += (new Date(r.saida).getTime() - new Date(r.entrada).getTime()) / 60000;
        }
      });
      const totalHours = totalMin / 60;
      return {
        data,
        registros: regs,
        totalMin,
        extraHours: Math.max(0, totalHours - carga),
        hasAnexo: regs.some(r => !!(r as any).anexo_url),
        editado: regs.some(r => !!(r as any).editado_manualmente),
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
    setAnexoUrl((day.registros[0] as any)?.anexo_url || null);
  };

  const updateField = (index: number, field: 'entrada' | 'saida', value: string) => {
    setEditFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const handleUploadAtestado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedDay) return;
    setUploading(true);
    const firstReg = selectedDay.registros[0];
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${firstReg.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('atestados')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('atestados').getPublicUrl(path);

    // Update all records of this day with the anexo
    for (const r of selectedDay.registros) {
      await supabase.from('registros_ponto').update({ anexo_url: urlData.publicUrl } as any).eq('id', r.id);
    }

    setAnexoUrl(urlData.publicUrl);
    toast({ title: 'Atestado anexado!', description: 'Arquivo salvo como prova.' });
    fetchRegistros();
    setUploading(false);
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
        const d = new Date(`${baseDate}T00:00:00`);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };

      const updateData: any = {
        editado_manualmente: true,
        editado_em: new Date().toISOString(),
        editado_por: user.id,
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
    if (day.totalMin === 0) return 'bg-muted text-muted-foreground';
    const hours = day.totalMin / 60;
    if (hours > 10 || day.extraHours > 2) return 'bg-destructive/20 text-destructive';
    if (day.extraHours > 0) return 'bg-warning/20 text-warning';
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

        {/* List grouped by day */}
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
                <button
                  key={day.data}
                  onClick={() => openEdit(day)}
                  className="w-full bg-card rounded-xl p-4 border border-border text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getBadgeColor(day)}`}>
                      {diaSemanaAbrev(date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1">
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        {day.hasAnexo && <Paperclip size={12} className="text-accent" />}
                        {day.editado && <span className="text-[10px] text-warning">✏️</span>}
                      </p>
                      {/* Show each pair */}
                      {day.registros.map((r, i) => (
                        <p key={r.id} className="text-xs text-muted-foreground">
                          {i === 0 ? '🌅' : '🌇'} {formatTime(new Date(r.entrada))}
                          {r.saida ? ` → ${formatTime(new Date(r.saida))}` : ' (aberto)'}
                        </p>
                      ))}
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
            {editFields.map((field, i) => (
              <div key={field.id}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {i === 0 ? '🌅 Período manhã' : '🌇 Período tarde'}
                </p>
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
            ))}

            <div>
              <label className="text-sm font-medium mb-1 block">Observação</label>
              <Input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Opcional" className="rounded-xl" />
            </div>

            {/* Anexar Atestado */}
            <div className="border border-dashed border-border rounded-xl p-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Paperclip size={14} />
                Anexar atestado / documento
              </p>
              {anexoUrl && (
                <a href={anexoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-accent underline flex items-center gap-1 mb-2">
                  <ExternalLink size={12} />
                  Ver documento anexado
                </a>
              )}
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleUploadAtestado} className="hidden" />
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-2 rounded-lg">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Enviando...' : anexoUrl ? 'Trocar arquivo' : 'Escolher arquivo'}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">
                Foto do atestado, PDF ou documento. Serve como prova jurídica.
              </p>
            </div>

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
