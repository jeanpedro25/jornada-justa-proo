import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarAlertas } from '@/lib/alertas';
import { formatTime, formatTimer, formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Play, Square, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

const AppPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registro, setRegistro] = useState<Registro | null>(null);
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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRegistro(data);
    if (data && !data.saida) {
      localStorage.setItem('hj_entrada_ts', data.entrada);
      localStorage.setItem('hj_registro_id', data.id);
    }
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

  // Timer
  useEffect(() => {
    if (!registro || registro.saida) return;
    const entradaTs = new Date(registro.entrada).getTime();
    const tick = () => setElapsed(Date.now() - entradaTs);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [registro]);

  const handleEntrada = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('registros_ponto')
      .insert({ user_id: user.id, data: today, entrada: now })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setRegistro(data);
      localStorage.setItem('hj_entrada_ts', now);
      localStorage.setItem('hj_registro_id', data.id);
      toast({ title: 'Entrada registrada!', description: `Você chegou às ${formatTime(new Date(now))}` });
    }
    setLoading(false);
  };

  const handleSaida = async () => {
    if (!registro || !user || !profile) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('registros_ponto')
      .update({ saida: now })
      .eq('id', registro.id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setRegistro(data);
      localStorage.removeItem('hj_entrada_ts');
      localStorage.removeItem('hj_registro_id');
      toast({ title: 'Saída registrada!', description: `Bom descanso!` });
      await gerarAlertas(data, profile);
      fetchUnread();
    }
    setLoading(false);
  };

  // Calculations
  const horasTrab = registro?.saida
    ? calcHorasTrabalhadas(registro.entrada, registro.saida, registro.intervalo_minutos ?? 60)
    : 0;
  const horaExtra = registro?.saida ? calcHoraExtra(horasTrab, profile?.carga_horaria_diaria ?? 8) : 0;
  const valorHE = profile ? calcValorHoraExtra(profile.salario_base ?? 0, profile.hora_extra_percentual ?? 50) : 0;
  const valorReceber = horaExtra * valorHE;

  // Live alert check
  const showLiveAlert = registro && !registro.saida && elapsed > 0;
  const hoursWorking = elapsed / 3600000;
  const alertaSemIntervalo = showLiveAlert && hoursWorking > 6;
  const alertaJornada = showLiveAlert && hoursWorking > 10;

  // State
  const isWorking = registro && !registro.saida;
  const isDone = registro && registro.saida;
  const noRecord = !registro;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Status Card */}
        <div className="bg-secondary rounded-2xl p-5 text-center shadow-sm">
          {noRecord && (
            <>
              <p className="text-muted-foreground mb-4">Você ainda não registrou sua entrada</p>
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
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse-slow" />
                <span className="text-success font-semibold text-sm">Trabalhando agora</span>
              </div>
              <p className="text-4xl font-bold tracking-tight mb-2">{formatTimer(elapsed)}</p>
              <p className="text-sm text-muted-foreground mb-4">
                entrada às {formatTime(new Date(registro.entrada))} · carga: {profile?.carga_horaria_diaria ?? 8}h
              </p>
              <div className="space-y-2">
                <Button
                  onClick={handleSaida}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-12 w-full font-semibold gap-2"
                >
                  <Square size={16} />
                  {loading ? 'Registrando...' : 'Fui embora'}
                </Button>
                <Button variant="outline" className="rounded-xl h-10 w-full text-sm gap-1">
                  <Plus size={14} />
                  Registrar intervalo
                </Button>
              </div>
            </>
          )}

          {isDone && (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 size={20} className="text-success" />
                <span className="font-semibold">Jornada encerrada</span>
              </div>
              <p className="text-2xl font-bold mb-1">{horasTrab.toFixed(1)}h trabalhadas</p>
              <p className="text-sm text-muted-foreground mb-2">
                {formatTime(new Date(registro.entrada))} — {formatTime(new Date(registro.saida!))}
              </p>
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                horaExtra > 0 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
              }`}>
                {horaExtra > 0 ? `+${horaExtra.toFixed(1)}h extra` : 'Jornada normal'}
              </span>
            </>
          )}
        </div>

        {/* Mini-cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">hora extra hoje</p>
            <p className={`text-lg font-bold ${horaExtra > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {horaExtra > 0 ? `${horaExtra.toFixed(1)}h` : '—'}
            </p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">a receber (est.)</p>
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
