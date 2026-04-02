import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, calcValorHoraExtra } from '@/lib/formatters';
import { horaLocalAgora } from '@/lib/dataHora';
import {
  buscarMarcacoesDia, calcularJornada, proximoTipoAvancado, registrarMarcacao,
  getEstadoJornada, calcularHoraExtra, formatarDuracaoJornada, formatarHoraLocal,
  getCargaDiaria, isDiaTrabalhoEscala, hojeLocal, getMarcacaoVisual,
  validarProximaMarcacao,
  type Marcacao,
} from '@/lib/jornada';
import { supabase } from '@/integrations/supabase/client';
import { sincronizarRegistroDia } from '@/lib/registro-dia';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import BancoHorasCards from '@/components/BancoHorasCards';
import AvisoLegal from '@/components/AvisoLegal';
import ProGate from '@/components/ProGate';
import PaywallModal from '@/components/PaywallModal';
import { usePaywall } from '@/hooks/usePaywall';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Clock } from 'lucide-react';

const AppPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { shouldShowPaywall, canSeeMoney } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [isDiaFolga, setIsDiaFolga] = useState(false);
  const [timerStr, setTimerStr] = useState('00:00:00');

  const today = hojeLocal();
  const p = profile as any;

  const fetchMarcacoes = useCallback(async () => {
    if (!user) return;
    const m = await buscarMarcacoesDia(user.id, today);
    setMarcacoes(m);
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

  useEffect(() => { fetchMarcacoes(); fetchUnread(); }, [fetchMarcacoes, fetchUnread]);

  // Escala rest day check
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

  // Auto paywall
  useEffect(() => {
    if (shouldShowPaywall('auto') && !sessionStorage.getItem('hj_paywall_shown')) {
      sessionStorage.setItem('hj_paywall_shown', '1');
      setTimeout(() => setShowPaywall(true), 2000);
    }
  }, [shouldShowPaywall]);

  const jornada = calcularJornada(marcacoes);
  const estado = getEstadoJornada(marcacoes);
  const proximo = proximoTipoAvancado(marcacoes);

  const cargaDiaria = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );

  const horaExtra = estado === 'encerrada' ? calcularHoraExtra(jornada.totalTrabalhado, cargaDiaria) : 0;
  const valorHE = profile ? calcValorHoraExtra(profile.salario_base ?? 0, profile.hora_extra_percentual ?? 50) : 0;
  const valorReceber = horaExtra * valorHE;

  // Live timer
  useEffect(() => {
    if (estado !== 'trabalhando') {
      setTimerStr('00:00:00');
      return;
    }
    const entradaTs = jornada.primeiraEntrada;
    if (!entradaTs) return;

    const tick = () => {
      const now = Date.now();
      let totalMs = 0;
      for (const per of jornada.periodos) {
        if (per.parcial && per.inicio) {
          totalMs += now - new Date(per.inicio).getTime();
        } else if (per.fim) {
          totalMs += new Date(per.fim).getTime() - new Date(per.inicio).getTime();
        }
      }
      const totalSeg = Math.floor(totalMs / 1000);
      const h = Math.floor(totalSeg / 3600);
      const m = Math.floor((totalSeg % 3600) / 60);
      const s = totalSeg % 60;
      setTimerStr(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [estado, jornada.periodos]);

  const handleMarcacao = async (tipo: typeof proximo.tipo) => {
    if (!user) return;
    const validacao = validarProximaMarcacao(marcacoes, tipo);
    if (!validacao.valido) {
      toast({ title: 'Marcação inválida', description: validacao.erro, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await registrarMarcacao(user.id, tipo);
      await sincronizarRegistroDia(user.id, today, p);
      await fetchMarcacoes();

      toast({
        title: tipo === 'entrada' ? '✅ Entrada registrada!' :
          tipo === 'saida_intervalo' ? '🍽 Saída para intervalo!' :
          tipo === 'volta_intervalo' ? '↩ Volta registrada!' :
          '🏠 Saída final registrada!',
        description: horaLocalAgora(),
      });

      if (tipo === 'saida_final') {
        fetchUnread();
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const getButtonStyle = (cor: string) => {
    switch (cor) {
      case 'success': return 'bg-success hover:bg-success/90 text-success-foreground';
      case 'warning': return 'bg-warning hover:bg-warning/90 text-warning-foreground';
      case 'accent': return 'bg-accent hover:bg-accent/90 text-accent-foreground';
      case 'destructive': return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
      default: return 'bg-primary hover:bg-primary/90 text-primary-foreground';
    }
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
          {estado === 'encerrada' ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 size={22} className="text-success" />
                <span className="font-semibold text-lg">Jornada encerrada</span>
              </div>
              <p className="text-2xl font-bold mb-1">{formatarDuracaoJornada(jornada.totalTrabalhado)} trabalhadas</p>
              <p className="text-sm text-muted-foreground mb-1">
                {formatarHoraLocal(jornada.primeiraEntrada)} — {formatarHoraLocal(jornada.ultimaSaida)}
              </p>
              {jornada.totalIntervalo > 0 && (
                <p className="text-xs text-muted-foreground mb-2">☕ Intervalo: {formatarDuracaoJornada(jornada.totalIntervalo)}</p>
              )}
              <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-full ${
                horaExtra > 0 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
              }`}>
                {horaExtra > 0 ? (
                  canSeeMoney
                    ? `+${formatarDuracaoJornada(Math.round(horaExtra * 60))} extra · Estimativa: ${formatCurrency(valorReceber)}`
                    : `+${formatarDuracaoJornada(Math.round(horaExtra * 60))} extra`
                ) : 'Jornada normal ✓'}
              </span>
              {horaExtra > 0 && !canSeeMoney && (
                <button onClick={() => setShowPaywall(true)} className="text-[10px] text-accent underline mt-1 block mx-auto">
                  Ver valor em dinheiro
                </button>
              )}
              {/* Allow new entry after encerrada */}
              <Button
                onClick={() => handleMarcacao('entrada')}
                disabled={loading}
                variant="outline"
                className="mt-4 rounded-xl gap-2 text-xs"
              >
                ▶ Adicionar período extra
              </Button>
            </>
          ) : estado === 'em_intervalo' ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-2xl">🍽</span>
                <span className="font-semibold text-lg">Em intervalo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Saiu às {formatarHoraLocal(marcacoes.filter(m => m.tipo === 'saida_intervalo').pop()?.horario || null)}
              </p>
              <Button
                onClick={() => handleMarcacao('volta_intervalo')}
                disabled={loading}
                className={`rounded-xl h-14 text-base font-semibold w-full gap-2 ${getButtonStyle('accent')}`}
              >
                ↩ {loading ? 'Registrando...' : 'Voltei do Intervalo'}
              </Button>
            </>
          ) : estado === 'trabalhando' ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <span className="font-semibold">Trabalhando agora</span>
              </div>
              <p className="text-3xl font-bold font-mono mb-1">{timerStr}</p>
              <p className="text-xs text-muted-foreground mb-4">
                Entrada: {formatarHoraLocal(jornada.primeiraEntrada)} · Carga: {cargaDiaria}h
              </p>
              <Button
                onClick={() => handleMarcacao(proximo.tipo)}
                disabled={loading}
                className={`rounded-xl h-14 text-base font-semibold w-full gap-2 ${getButtonStyle(proximo.cor)}`}
              >
                {proximo.icone} {loading ? 'Registrando...' : proximo.label}
              </Button>
              {proximo.alternativo && (
                <Button
                  onClick={() => handleMarcacao(proximo.alternativo!.tipo)}
                  disabled={loading}
                  variant="outline"
                  className="mt-2 rounded-xl gap-2 text-xs w-full"
                >
                  {proximo.alternativo.icone} {proximo.alternativo.label}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{horaLocalAgora()}</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Registre sua entrada e pode fechar o app.
              </p>
              <Button
                onClick={() => handleMarcacao('entrada')}
                disabled={loading}
                className={`rounded-xl h-14 text-base font-semibold w-full gap-2 ${getButtonStyle('success')}`}
              >
                ▶ {loading ? 'Registrando...' : 'Bater Entrada'}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3">
                📱 Você pode fechar o app após registrar. Seu ponto está salvo.
              </p>
            </>
          )}
        </div>

        {/* Registros de hoje */}
        {marcacoes.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground font-semibold mb-3">REGISTROS DE HOJE</p>
            <div className="space-y-2">
              {marcacoes.map((m) => {
                const visual = getMarcacaoVisual(m.tipo);
                return (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <span>{visual.icone}</span>
                    <span className="text-muted-foreground text-xs w-28">{visual.label}</span>
                    <span className="font-semibold">{formatarHoraLocal(m.horario)}</span>
                  </div>
                );
              })}
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
              {horaExtra > 0 ? `${horaExtra.toFixed(2)}h` : '—'}
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
