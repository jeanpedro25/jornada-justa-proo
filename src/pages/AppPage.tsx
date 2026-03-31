import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarAlertas } from '@/lib/alertas';
import { formatTime, formatCurrency, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { LogIn, LogOut, Coffee, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import AttachFile from '@/components/AttachFile';
import EditRegistro from '@/components/EditRegistro';
import BancoHorasCards from '@/components/BancoHorasCards';
import AvisoLegal from '@/components/AvisoLegal';
import { calcularEntradaBancoHoras, insertBancoHorasEntry, type BancoHorasConfig } from '@/lib/banco-horas';
import ProGate from '@/components/ProGate';
import PaywallModal from '@/components/PaywallModal';
import { usePaywall } from '@/hooks/usePaywall';

type Registro = Tables<'registros_ponto'>;

const STEPS = [
  { label: 'Entrada', icon: LogIn, action: 'entrada_manha' },
  { label: 'Almoço', icon: Coffee, action: 'saida_almoco' },
  { label: 'Volta', icon: LogIn, action: 'entrada_tarde' },
  { label: 'Saída', icon: LogOut, action: 'saida_final' },
] as const;

const AppPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { shouldShowPaywall, canSeeMoney } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
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

  // Determine current step based on records
  const getCurrentStep = (): number => {
    if (registros.length === 0) return 0; // No records — next: Entrada
    const r0 = registros[0];
    const r1 = registros[1];
    if (!r0.saida) return 0; // shouldn't happen but safety
    if (r0.saida && !r1) return 1; // Has entrada+saída manhã, waiting volta? Actually step 1 done, need step 2
    // Let me think differently:
    // Step 0: Entrada (creates record 1 with entrada)
    // Step 1: Almoço (sets saída on record 1)
    // Step 2: Volta (creates record 2 with entrada)
    // Step 3: Saída (sets saída on record 2)

    const rec1 = registros[0];
    const rec2 = registros[1];

    if (!rec1) return 0;
    if (rec1 && !rec1.saida) return 1; // Entrada done, next: Almoço (saída)
    if (rec1 && rec1.saida && !rec2) return 2; // Almoço done, next: Volta (entrada tarde)
    if (rec2 && !rec2.saida) return 3; // Volta done, next: Saída final
    if (rec2 && rec2.saida) return 4; // All done
    return 0;
  };

  const currentStep = getCurrentStep();
  const jornadaCompleta = currentStep === 4;

  const handlePunch = async () => {
    if (!user || !profile) return;
    setLoading(true);
    const now = new Date().toISOString();

    try {
      if (currentStep === 0) {
        // Entrada manhã — create record 1
        await supabase.from('registros_ponto').insert({
          user_id: user.id,
          data: today,
          entrada: now,
          intervalo_minutos: 0,
        });
        toast({ title: '✅ Entrada registrada!', description: `${formatTime(new Date(now))} — Bom trabalho!` });
      } else if (currentStep === 1) {
        // Saída almoço — set saída on record 1
        await supabase.from('registros_ponto').update({ saida: now }).eq('id', registros[0].id);
        toast({ title: '🍽️ Saída pro almoço!', description: `${formatTime(new Date(now))} — Bom apetite!` });
      } else if (currentStep === 2) {
        // Volta do almoço — create record 2
        await supabase.from('registros_ponto').insert({
          user_id: user.id,
          data: today,
          entrada: now,
          intervalo_minutos: 0,
        });
        toast({ title: '✅ Volta registrada!', description: `${formatTime(new Date(now))} — Boa tarde!` });
      } else if (currentStep === 3) {
        // Saída final — set saída on record 2
        await supabase.from('registros_ponto').update({ saida: now }).eq('id', registros[1].id);
        toast({ title: '🏠 Saída registrada!', description: `${formatTime(new Date(now))} — Bom descanso!` });
      }

      await fetchToday();

      // Generate alerts and banco de horas after final exit
      if (currentStep === 3) {
        const { data: regs } = await supabase
          .from('registros_ponto')
          .select('*')
          .eq('user_id', user.id)
          .eq('data', today)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (regs && regs.length >= 2) {
          const lunchMin = calcLunchMinutes(regs);
          const syntheticRecord: Registro = {
            ...regs[regs.length - 1],
            entrada: regs[0].entrada,
            saida: now,
            intervalo_minutos: lunchMin,
          };
          await gerarAlertas(syntheticRecord, profile);
          fetchUnread();

          // Banco de horas entry
          const p = profile as any;
          if (p.modo_trabalho === 'banco_horas') {
            const totalWorkedMin = regs.reduce((t: number, r: Registro) => {
              if (!r.saida) return t;
              return t + (new Date(r.saida).getTime() - new Date(r.entrada).getTime()) / 60000;
            }, 0);
            const cargaMin = (profile.carga_horaria_diaria ?? 8) * 60;
            const diff = totalWorkedMin - lunchMin - cargaMin;
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
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const calcTotalWorkedMinutes = (regs: Registro[]) => {
    return regs.reduce((total, r) => {
      if (!r.saida) return total;
      const diffMs = new Date(r.saida).getTime() - new Date(r.entrada).getTime();
      return total + Math.max(0, diffMs / 60000);
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

  const totalWorkedMin = calcTotalWorkedMinutes(registros);
  const totalWorkedHours = totalWorkedMin / 60;
  const lunchMin = calcLunchMinutes(registros);
  const horaExtra = jornadaCompleta ? calcHoraExtra(totalWorkedHours, profile?.carga_horaria_diaria ?? 8) : 0;
  const valorHE = profile ? calcValorHoraExtra(profile.salario_base ?? 0, profile.hora_extra_percentual ?? 50) : 0;
  const valorReceber = horaExtra * valorHE;

  const getButtonConfig = () => {
    switch (currentStep) {
      case 0: return { text: 'Bater Entrada', icon: LogIn, color: 'bg-success hover:bg-success/90 text-success-foreground' };
      case 1: return { text: 'Saí pro Almoço', icon: Coffee, color: 'bg-warning hover:bg-warning/90 text-warning-foreground' };
      case 2: return { text: 'Voltei do Almoço', icon: LogIn, color: 'bg-success hover:bg-success/90 text-success-foreground' };
      case 3: return { text: 'Bater Saída', icon: LogOut, color: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' };
      default: return null;
    }
  };

  const btnConfig = getButtonConfig();

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2">
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step.label} className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-success text-success-foreground' :
                  active ? 'bg-accent text-accent-foreground scale-110 shadow-md' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {done ? '✓' : <step.icon size={16} />}
                </div>
                <span className={`text-[10px] ${active ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Main Action Card */}
        <div className="bg-secondary rounded-2xl p-6 text-center shadow-sm">
          {!jornadaCompleta && btnConfig ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                {currentStep === 0 && 'Registre sua entrada e pode fechar o app.'}
                {currentStep === 1 && 'Hora do almoço? Registre e vá descansar.'}
                {currentStep === 2 && 'Voltou? Registre e continue seu dia.'}
                {currentStep === 3 && 'Fim do expediente? Registre sua saída.'}
              </p>

              <Button
                onClick={handlePunch}
                disabled={loading}
                className={`${btnConfig.color} rounded-xl h-14 text-base font-semibold w-full gap-2`}
              >
                <btnConfig.icon size={20} />
                {loading ? 'Registrando...' : btnConfig.text}
              </Button>

              <p className="text-[11px] text-muted-foreground mt-3">
                📱 Você pode fechar o app após registrar. Seu ponto está salvo.
              </p>
            </>
          ) : jornadaCompleta ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 size={22} className="text-success" />
                <span className="font-semibold text-lg">Jornada encerrada</span>
              </div>
              <p className="text-2xl font-bold mb-1">{totalWorkedHours.toFixed(1)}h trabalhadas</p>
              <p className="text-sm text-muted-foreground mb-1">
                {formatTime(new Date(registros[0].entrada))} — {formatTime(new Date(registros[registros.length - 1].saida!))}
              </p>
              {lunchMin > 0 && (
                <p className="text-xs text-muted-foreground mb-2">☕ Almoço: {lunchMin}min</p>
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
            </>
          ) : null}
        </div>

        {/* Registros de hoje */}
        {registros.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-semibold">REGISTROS DE HOJE</p>
              <AttachFile
                registroId={registros[0].id}
                currentUrl={(registros[0] as any).anexo_url}
                onAttached={fetchToday}
              />
            </div>
            <div className="space-y-3">
              {registros.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full ${r.saida ? 'bg-success' : 'bg-warning animate-pulse'}`} />
                    <span className="text-muted-foreground w-14 font-medium">{i === 0 ? 'Manhã' : 'Tarde'}</span>
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

        <AvisoLegal />
      </div>

      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={valorReceber} />
      <BottomNav unreadAlerts={unreadAlerts} />
    </div>
  );
};

export default AppPage;
