import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarAlertas } from '@/lib/alertas';
import { formatTime, formatTimer, formatCurrency, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Play, Square, CheckCircle2, AlertTriangle, Coffee, Sun, Sunset } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

const AppPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const fetchToday = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('user_id', user.id)
      .eq('data', today)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    setRegistros(data || []);
  }, [user, today]);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('alertas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('lido', false);
    setUnreadAlerts(count || 0);
  }, [user]);

  useEffect(() => {
    fetchToday();
    fetchUnread();
  }, [fetchToday, fetchUnread]);

  // Active record (last one without saída)
  const activeRecord = registros.find(r => !r.saida);

  // Timer for active record
  useEffect(() => {
    if (!activeRecord) { setElapsed(0); return; }
    const entradaTs = new Date(activeRecord.entrada).getTime();
    const tick = () => setElapsed(Date.now() - entradaTs);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeRecord]);

  const handleEntrada = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('registros_ponto')
      .insert({ user_id: user.id, data: today, entrada: now, intervalo_minutos: 0 })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      await fetchToday();
      const periodo = registros.length === 0 ? 'manhã' : 'tarde';
      toast({ title: 'Entrada registrada!', description: `Período da ${periodo} iniciado às ${formatTime(new Date(now))}` });
    }
    setLoading(false);
  };

  const handleSaida = async () => {
    if (!activeRecord || !user || !profile) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('registros_ponto')
      .update({ saida: now })
      .eq('id', activeRecord.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      await fetchToday();
      const completedCount = registros.filter(r => r.saida).length + 1;
      if (completedCount === 1) {
        toast({ title: 'Saída registrada!', description: 'Bom almoço! Não esqueça de bater o ponto na volta.' });
      } else {
        toast({ title: 'Saída registrada!', description: 'Bom descanso!' });
        // Generate alerts on final exit
        const { data: updatedRegistros } = await supabase
          .from('registros_ponto')
          .select('*')
          .eq('user_id', user.id)
          .eq('data', today)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
        if (updatedRegistros && updatedRegistros.length > 0) {
          // Use last record with total calculated interval
          const totalWorkedMin = calcTotalWorkedMinutes(updatedRegistros);
          const lunchMin = calcLunchMinutes(updatedRegistros);
          const lastRec = updatedRegistros[updatedRegistros.length - 1];
          const syntheticRecord: Registro = {
            ...lastRec,
            entrada: updatedRegistros[0].entrada,
            saida: now,
            intervalo_minutos: lunchMin,
          };
          await gerarAlertas(syntheticRecord, profile);
          fetchUnread();
        }
      }
    }
    setLoading(false);
  };

  // Calculations
  const calcTotalWorkedMinutes = (regs: Registro[]) => {
    return regs.reduce((total, r) => {
      if (!r.saida) return total;
      const diff = (new Date(r.saida).getTime() - new Date(r.entrada).getTime()) / 60000;
      return total + diff;
    }, 0);
  };

  const calcLunchMinutes = (regs: Registro[]) => {
    if (regs.length < 2) return 0;
    let totalPause = 0;
    for (let i = 1; i < regs.length; i++) {
      const prevSaida = regs[i - 1].saida;
      if (prevSaida) {
        const gap = (new Date(regs[i].entrada).getTime() - new Date(prevSaida).getTime()) / 60000;
        totalPause += Math.max(0, gap);
      }
    }
    return Math.round(totalPause);
  };

  const completedRecords = registros.filter(r => r.saida);
  const totalWorkedMin = calcTotalWorkedMinutes(registros);
  const totalWorkedHours = totalWorkedMin / 60;
  const lunchMin = calcLunchMinutes(registros);
  const allDone = registros.length > 0 && !activeRecord;
  const jornadaCompleta = completedRecords.length >= 2 && allDone;

  const horaExtra = jornadaCompleta ? calcHoraExtra(totalWorkedHours, profile?.carga_horaria_diaria ?? 8) : 0;
  const valorHE = profile ? calcValorHoraExtra(profile.salario_base ?? 0, profile.hora_extra_percentual ?? 50) : 0;
  const valorReceber = horaExtra * valorHE;

  // Live alerts
  const totalElapsedMin = totalWorkedMin + (activeRecord ? elapsed / 60000 : 0);
  const totalElapsedHours = totalElapsedMin / 60;
  const alertaSemIntervalo = activeRecord && registros.length === 1 && totalElapsedHours > 6;
  const alertaJornada = totalElapsedHours > 10;

  // Determine current state
  const noRecords = registros.length === 0;
  const isWorking = !!activeRecord;
  const isOnLunch = completedRecords.length === 1 && !activeRecord;
  const pairCount = completedRecords.length;

  // Step label
  const getStepLabel = () => {
    if (noRecords) return { step: 1, label: 'Entrada manhã', icon: Sun };
    if (isWorking && pairCount === 0) return { step: 1, label: 'Trabalhando (manhã)', icon: Sun };
    if (isOnLunch) return { step: 2, label: 'Intervalo (almoço)', icon: Coffee };
    if (isWorking && pairCount >= 1) return { step: 3, label: 'Trabalhando (tarde)', icon: Sunset };
    if (jornadaCompleta) return { step: 4, label: 'Jornada encerrada', icon: CheckCircle2 };
    return { step: 0, label: '', icon: Sun };
  };

  const stepInfo = getStepLabel();

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2">
          {['Entrada', 'Almoço', 'Volta', 'Saída'].map((label, i) => {
            const stepNum = i + 1;
            const done = (stepNum === 1 && pairCount >= 1) ||
                         (stepNum === 2 && (isOnLunch || pairCount >= 1 && registros.length > 1)) ||
                         (stepNum === 3 && pairCount >= 2) ||
                         (stepNum === 4 && jornadaCompleta);
            const active = (stepNum === 1 && noRecords) ||
                           (stepNum === 1 && isWorking && pairCount === 0) ||
                           (stepNum === 2 && isOnLunch) ||
                           (stepNum === 3 && isWorking && pairCount >= 1) ||
                           (stepNum === 4 && isWorking && pairCount >= 1);
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done ? 'bg-success text-success-foreground' :
                  active ? 'bg-accent text-accent-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {done ? '✓' : stepNum}
                </div>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Status Card */}
        <div className="bg-secondary rounded-2xl p-5 text-center shadow-sm">
          {noRecords && (
            <>
              <p className="text-muted-foreground mb-4">Você ainda não registrou sua entrada hoje</p>
              <Button
                onClick={handleEntrada}
                disabled={loading}
                className="bg-success hover:bg-success/90 text-success-foreground rounded-xl h-14 text-base font-semibold w-full gap-2"
              >
                <Play size={18} />
                {loading ? 'Registrando...' : 'Cheguei no trabalho'}
              </Button>
            </>
          )}

          {isWorking && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="text-success font-semibold text-sm">
                  {pairCount === 0 ? 'Trabalhando (manhã)' : 'Trabalhando (tarde)'}
                </span>
              </div>
              <p className="text-4xl font-bold tracking-tight mb-2">{formatTimer(elapsed)}</p>
              <p className="text-sm text-muted-foreground mb-4">
                entrada às {formatTime(new Date(activeRecord!.entrada))} · carga: {profile?.carga_horaria_diaria ?? 8}h
              </p>
              <Button
                onClick={handleSaida}
                disabled={loading}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-12 w-full font-semibold gap-2"
              >
                <Square size={16} />
                {loading ? 'Registrando...' : pairCount === 0 ? 'Saí pro almoço' : 'Fui embora'}
              </Button>
            </>
          )}

          {isOnLunch && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Coffee size={20} className="text-warning" />
                <span className="text-warning font-semibold text-sm">Intervalo de almoço</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Saiu às {formatTime(new Date(completedRecords[0].saida!))} · Bom apetite!
              </p>
              <Button
                onClick={handleEntrada}
                disabled={loading}
                className="bg-success hover:bg-success/90 text-success-foreground rounded-xl h-14 text-base font-semibold w-full gap-2"
              >
                <Play size={18} />
                {loading ? 'Registrando...' : 'Voltei do almoço'}
              </Button>
            </>
          )}

          {jornadaCompleta && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 size={20} className="text-success" />
                <span className="font-semibold">Jornada encerrada</span>
              </div>
              <p className="text-2xl font-bold mb-1">{totalWorkedHours.toFixed(1)}h trabalhadas</p>
              <p className="text-sm text-muted-foreground mb-1">
                {formatTime(new Date(registros[0].entrada))} — {formatTime(new Date(registros[registros.length - 1].saida!))}
              </p>
              {lunchMin > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  ☕ Almoço: {lunchMin}min
                </p>
              )}
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                horaExtra > 0 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
              }`}>
                {horaExtra > 0 ? `+${horaExtra.toFixed(1)}h extra` : 'Jornada normal'}
              </span>
            </>
          )}
        </div>

        {/* Timeline */}
        {registros.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground font-semibold mb-3">REGISTROS DE HOJE</p>
            <div className="space-y-2">
              {registros.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${r.saida ? 'bg-success' : 'bg-warning'}`} />
                  <span className="text-muted-foreground w-16">{i === 0 ? 'Manhã' : `Tarde`}</span>
                  <span className="font-medium">{formatTime(new Date(r.entrada))}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{r.saida ? formatTime(new Date(r.saida)) : '...'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mini-cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">hora extra hoje</p>
            <p className={`text-lg font-bold ${horaExtra > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {horaExtra > 0 ? `${horaExtra.toFixed(1)}h` : '—'}
            </p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">o patrão te deve (est.)</p>
            <p className={`text-lg font-bold ${valorReceber > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
              {valorReceber > 0 ? formatCurrency(valorReceber) : '—'}
            </p>
          </div>
        </div>

        {/* Alert Banners */}
        {alertaSemIntervalo && (
          <div className="bg-warning/10 border border-warning/40 rounded-xl p-4 flex gap-3 items-start">
            <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-warning font-medium">
              Você está há mais de 6h sem intervalo. A CLT exige pausa mínima de 1h.
            </p>
          </div>
        )}
        {alertaJornada && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex gap-3 items-start">
            <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-medium">
              Você já trabalhou mais de 10h hoje. Jornada acima de 10h é irregular pela CLT.
            </p>
          </div>
        )}
      </div>

      <BottomNav unreadAlerts={unreadAlerts} />
    </div>
  );
};

export default AppPage;
