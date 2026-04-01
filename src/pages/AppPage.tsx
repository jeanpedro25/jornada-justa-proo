import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarAlertas } from '@/lib/alertas';
import { formatCurrency, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import { formatarHora, dataHojeLocal, agoraUTC, horaLocalAgora } from '@/lib/dataHora';
import { getCargaDiaria, calcTotalWorkedMinutes, calcPauseMinutes, isDiaTrabalhoEscala } from '@/lib/jornada';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { LogIn, LogOut, CheckCircle2, Clock, Plus } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import EditRegistro from '@/components/EditRegistro';
import BancoHorasCards from '@/components/BancoHorasCards';
import AvisoLegal from '@/components/AvisoLegal';
import ManualEntry from '@/components/ManualEntry';
import { calcularEntradaBancoHoras, insertBancoHorasEntry, type BancoHorasConfig } from '@/lib/banco-horas';
import ProGate from '@/components/ProGate';
import PaywallModal from '@/components/PaywallModal';
import { usePaywall } from '@/hooks/usePaywall';

type Registro = Tables<'registros_ponto'>;

const AppPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { shouldShowPaywall, canSeeMoney } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [isDiaFolga, setIsDiaFolga] = useState(false);

  const today = dataHojeLocal();
  const p = profile as any;

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

  // Check if today is a rest day for escala
  useEffect(() => {
    if (p?.tipo_jornada === 'escala' && p?.escala_tipo && p?.escala_inicio) {
      const isWork = isDiaTrabalhoEscala({
        tipo: p.escala_tipo,
        diasTrabalho: p.escala_dias_trabalho || 5,
        diasFolga: p.escala_dias_folga || 2,
        inicio: p.escala_inicio,
      }, today);
      setIsDiaFolga(!isWork);
    } else {
      setIsDiaFolga(false);
    }
  }, [p, today]);

  // Auto-show paywall
  useEffect(() => {
    if (shouldShowPaywall('auto') && !sessionStorage.getItem('hj_paywall_shown')) {
      sessionStorage.setItem('hj_paywall_shown', '1');
      setTimeout(() => setShowPaywall(true), 2000);
    }
  }, [shouldShowPaywall]);

  // Determine current action: entrada or saida for the latest open record
  const lastRecord = registros[registros.length - 1];
  const hasOpenRecord = lastRecord && !lastRecord.saida;
  const allClosed = registros.length > 0 && registros.every(r => r.saida);

  // Get carga diária based on jornada type
  const cargaDiaria = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );

  const handleEntrada = async () => {
    if (!user) return;
    setLoading(true);
    const now = agoraUTC();
    try {
      await supabase.from('registros_ponto').insert({
        user_id: user.id,
        data: today,
        entrada: now,
        intervalo_minutos: 0,
      });
      toast({ title: '✅ Entrada registrada!', description: `${formatarHora(now)} — Bom trabalho!` });
      await fetchToday();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSaida = async () => {
    if (!user || !lastRecord) return;
    setLoading(true);
    const now = agoraUTC();
    try {
      await supabase.from('registros_ponto').update({ saida: now }).eq('id', lastRecord.id);
      toast({ title: '🏠 Saída registrada!', description: `${formatarHora(now)}` });
      await fetchToday();

      // After closing a record, check if we should generate alerts/banco
      const { data: regs } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('user_id', user.id)
        .eq('data', today)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (regs && regs.length > 0) {
        const pauseMin = calcPauseMinutes(regs);
        const syntheticRecord: Registro = {
          ...regs[regs.length - 1],
          entrada: regs[0].entrada,
          saida: now,
          intervalo_minutos: pauseMin,
        };
        await gerarAlertas(syntheticRecord, profile!);
        fetchUnread();

        // Banco de horas
        if (p?.modo_trabalho === 'banco_horas') {
          const totalWorkedMin = calcTotalWorkedMinutes(regs);
          const cargaMin = cargaDiaria * 60;
          const diff = totalWorkedMin - pauseMin - cargaMin;
          const bhConfig: BancoHorasConfig = {
            modoTrabalho: 'banco_horas',
            prazoCompensacaoDias: p.prazo_compensacao_dias ?? 180,
            regraConversao: p.regra_conversao ?? '1.5x',
            limiteBancoHoras: p.limite_banco_horas,
          };
          const entry = calcularEntradaBancoHoras(user.id, today, diff, bhConfig, regs[0].id);
          if (entry) await insertBancoHorasEntry(entry);
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const totalWorkedMin = calcTotalWorkedMinutes(registros);
  const totalWorkedHours = totalWorkedMin / 60;
  const pauseMin = calcPauseMinutes(registros);
  const horaExtra = allClosed ? calcHoraExtra(totalWorkedHours, cargaDiaria) : 0;
  const valorHE = profile ? calcValorHoraExtra(profile.salario_base ?? 0, profile.hora_extra_percentual ?? 50) : 0;
  const valorReceber = horaExtra * valorHE;

  const getPeriodLabel = (index: number) => {
    if (registros.length <= 2) {
      return index === 0 ? 'Manhã' : 'Tarde';
    }
    return `Período ${index + 1}`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Escala rest day notice */}
        {isDiaFolga && (
          <div className="bg-accent/10 rounded-xl p-4 text-center border border-accent/20">
            <p className="text-sm font-semibold text-accent">📅 Hoje é dia de folga na sua escala</p>
            <p className="text-xs text-muted-foreground mt-1">Você ainda pode registrar ponto se precisar.</p>
          </div>
        )}

        {/* Main Action Card */}
        <div className="bg-secondary rounded-2xl p-6 text-center shadow-sm">
          {allClosed && registros.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 size={22} className="text-success" />
                <span className="font-semibold text-lg">Jornada encerrada</span>
              </div>
              <p className="text-2xl font-bold mb-1">{totalWorkedHours.toFixed(1)}h trabalhadas</p>
              <p className="text-sm text-muted-foreground mb-1">
                {formatarHora(registros[0].entrada)} — {formatarHora(registros[registros.length - 1].saida)}
              </p>
              {pauseMin > 0 && (
                <p className="text-xs text-muted-foreground mb-2">☕ Intervalo: {pauseMin}min</p>
              )}
              <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-full ${
                horaExtra > 0 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
              }`}>
                {horaExtra > 0 ? (
                  canSeeMoney
                    ? `+${horaExtra.toFixed(1)}h extra · Estimativa: ${formatCurrency(valorReceber)}`
                    : `+${horaExtra.toFixed(1)}h extra`
                ) : 'Jornada normal ✓'}
              </span>
              {horaExtra > 0 && !canSeeMoney && (
                <button onClick={() => setShowPaywall(true)} className="text-[10px] text-accent underline mt-1 block mx-auto">
                  Ver valor em dinheiro
                </button>
              )}

              {/* Add extra period */}
              <Button
                onClick={handleEntrada}
                disabled={loading}
                variant="outline"
                className="mt-4 rounded-xl gap-2 text-xs"
              >
                <Plus size={14} />
                Adicionar período extra
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {horaLocalAgora()}
                </span>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                {registros.length === 0
                  ? 'Registre sua entrada e pode fechar o app.'
                  : hasOpenRecord
                    ? 'Registre a saída quando terminar.'
                    : 'Continue seu dia registrando uma nova entrada.'}
              </p>

              {hasOpenRecord ? (
                <Button
                  onClick={handleSaida}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-14 text-base font-semibold w-full gap-2"
                >
                  <LogOut size={20} />
                  {loading ? 'Registrando...' : 'Bater Saída'}
                </Button>
              ) : (
                <Button
                  onClick={handleEntrada}
                  disabled={loading}
                  className="bg-success hover:bg-success/90 text-success-foreground rounded-xl h-14 text-base font-semibold w-full gap-2"
                >
                  <LogIn size={20} />
                  {loading ? 'Registrando...' : registros.length === 0 ? 'Bater Entrada' : 'Nova Entrada'}
                </Button>
              )}

              <p className="text-[11px] text-muted-foreground mt-3">
                📱 Você pode fechar o app após registrar. Seu ponto está salvo.
              </p>
            </>
          )}
        </div>

        {/* Registros de hoje */}
        {registros.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-semibold">REGISTROS DE HOJE</p>
              <AttachFile
                registroIds={registros.map(r => r.id)}
                currentUrl={registros[0]?.anexo_url}
                currentPeriodo={(registros[0] as any)?.atestado_periodo || null}
                onAttached={fetchToday}
                onRemoved={fetchToday}
              />
            </div>
            <div className="space-y-3">
              {registros.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full ${r.saida ? 'bg-success' : 'bg-warning animate-pulse'}`} />
                    <span className="text-muted-foreground w-16 font-medium text-xs">{getPeriodLabel(i)}</span>
                    <span className="font-semibold">{formatTime(new Date(r.entrada))}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`font-semibold ${r.saida ? '' : 'text-muted-foreground'}`}>
                      {r.saida ? formatTime(new Date(r.saida)) : 'aguardando'}
                    </span>
                  </div>
                  <EditRegistro
                    registroId={r.id}
                    entrada={r.entrada}
                    saida={r.saida}
                    onEdited={fetchToday}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banco de Horas Cards */}
        <BancoHorasCards />

        {/* Mini-cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">hora extra hoje</p>
            <p className={`text-lg font-bold ${horaExtra > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {horaExtra > 0 ? `${horaExtra.toFixed(1)}h` : '—'}
            </p>
          </div>
          <ProGate action="money" blurred estimatedValue={valorReceber}>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">valor estimado hoje</p>
              <p className={`text-lg font-bold ${valorReceber > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                {valorReceber > 0 ? formatCurrency(valorReceber) : '—'}
              </p>
            </div>
          </ProGate>
        </div>

        {/* Manual entry */}
        <ManualEntry onAdded={fetchToday} />

        <AvisoLegal />
      </div>

      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={valorReceber} />
      <BottomNav unreadAlerts={unreadAlerts} />
    </div>
  );
};

export default AppPage;
