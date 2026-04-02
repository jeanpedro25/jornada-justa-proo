import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchBancoHorasEntries,
  summarizeBancoHoras,
  formatMinutosHoras,
  type BancoHorasSummary,
} from '@/lib/banco-horas';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Clock, TrendingUp, AlertTriangle, DollarSign, Calculator, CalendarMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function calcEquivDias(min: number, cargaH: number): string {
  if (cargaH <= 0 || min === 0) return '';
  const dias = Math.abs(min) / (cargaH * 60);
  if (dias === Math.floor(dias)) return `${Math.floor(dias)} dia${dias !== 1 ? 's' : ''}`;
  const d = Math.floor(dias);
  const h = ((dias - d) * cargaH).toFixed(2);
  if (d === 0) return `${h}h`;
  return `${d} dia${d !== 1 ? 's' : ''} e ${h}h`;
}

const BancoHorasCards: React.FC = () => {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<BancoHorasSummary | null>(null);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [totalCompensado, setTotalCompensado] = useState(0);
  const [showSim, setShowSim] = useState(false);
  const [showCompensacao, setShowCompensacao] = useState(false);
  const [compData, setCompData] = useState('');
  const [compHoras, setCompHoras] = useState('');
  const [compMinutos, setCompMinutos] = useState('');
  const [compObs, setCompObs] = useState('');
  const [compTipo, setCompTipo] = useState('dia_completo');
  const [savingComp, setSavingComp] = useState(false);

  const p = profile as any;
  const cargaDiaria = p?.carga_horaria_diaria ?? 8;

  const load = useCallback(async () => {
    if (!user || !profile) return;
    const entries = await fetchBancoHorasEntries(user.id);
    const s = summarizeBancoHoras(
      entries,
      profile.salario_base ?? 0,
      profile.hora_extra_percentual ?? 50,
    );
    setSummary(s);
    setSaldoInicial(p?.banco_horas_saldo_inicial ?? 0);

    // Fetch compensações
    const { data: comps } = await supabase
      .from('compensacoes_banco_horas' as any)
      .select('minutos')
      .eq('user_id', user.id);
    const total = (comps as any[] || []).reduce((acc: number, c: any) => acc + c.minutos, 0);
    setTotalCompensado(total);
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  if (!summary || p?.modo_trabalho !== 'banco_horas') return null;

  const saldoRegistros = summary.saldo;
  const saldoFinal = saldoInicial + saldoRegistros - totalCompensado;
  const saldoPositivo = saldoFinal >= 0;

  const handleCompensar = async () => {
    if (!user) return;
    const minutos = compTipo === 'dia_completo'
      ? cargaDiaria * 60
      : (Number(compHoras) || 0) * 60 + (Number(compMinutos) || 0);
    if (minutos <= 0 || !compData) {
      toast({ title: 'Preencha data e quantidade', variant: 'destructive' });
      return;
    }
    setSavingComp(true);
    const { error } = await supabase.from('compensacoes_banco_horas' as any).insert({
      user_id: user.id,
      data: compData,
      minutos,
      tipo: compTipo,
      observacao: compObs.trim() || null,
    } as any);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Compensação registrada!' });
      setShowCompensacao(false);
      setCompData(''); setCompHoras(''); setCompMinutos(''); setCompObs('');
      load();
    }
    setSavingComp(false);
  };

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground px-1">BANCO DE HORAS</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Saldo total */}
          <div className={`rounded-xl p-4 border ${
            saldoPositivo ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className={saldoPositivo ? 'text-success' : 'text-destructive'} />
              <p className="text-[10px] text-muted-foreground uppercase">Saldo total</p>
            </div>
            <p className={`text-lg font-bold ${saldoPositivo ? 'text-success' : 'text-destructive'}`}>
              {formatMinutosHoras(saldoFinal)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              → {calcEquivDias(saldoFinal, cargaDiaria)} disponíveis
            </p>
          </div>

          {/* Compensado */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase">Compensado</p>
            </div>
            <p className="text-lg font-bold">
              {totalCompensado > 0 ? formatMinutosHoras(-totalCompensado) : '—'}
            </p>
          </div>

          {/* Detalhamento */}
          {saldoInicial !== 0 && (
            <div className="bg-card rounded-xl p-4 border border-border col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-2">Detalhamento</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo inicial:</span>
                  <span className="font-medium">{formatMinutosHoras(saldoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horas do período:</span>
                  <span className="font-medium">{formatMinutosHoras(saldoRegistros)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compensado:</span>
                  <span className="font-medium">{formatMinutosHoras(-totalCompensado)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Expirando */}
          {summary.expirandoEm10Dias > 0 && (
            <div className="bg-warning/10 rounded-xl p-4 border border-warning/30">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-warning" />
                <p className="text-[10px] text-warning uppercase">Vencendo</p>
              </div>
              <p className="text-lg font-bold text-warning">
                {formatMinutosHoras(summary.expirandoEm10Dias)}
              </p>
              <p className="text-[10px] text-warning/70">em 10 dias</p>
            </div>
          )}

          {/* Estimativa valor */}
          {summary.estimativaValor > 0 && (
            <div className="bg-accent/10 rounded-xl p-4 border border-accent/30">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} className="text-accent" />
                <p className="text-[10px] text-muted-foreground uppercase">Estimativa</p>
              </div>
              <p className="text-lg font-bold text-accent">
                ≈ {formatCurrency(summary.estimativaValor)}
              </p>
            </div>
          )}
        </div>

        {/* Expirado alert */}
        {summary.expirado > 0 && (
          <div className="bg-destructive/10 rounded-xl p-3 border border-destructive/30 flex items-center gap-2">
            <AlertTriangle size={14} className="text-destructive shrink-0" />
            <p className="text-xs text-destructive">
              Você tem {formatMinutosHoras(summary.expirado)} de horas vencidas que não foram compensadas.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {saldoFinal > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl gap-2 text-xs"
              onClick={() => setShowSim(true)}
            >
              <Calculator size={14} />
              Simular valor
            </Button>
          )}
          {saldoFinal > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl gap-2 text-xs"
              onClick={() => setShowCompensacao(true)}
            >
              <CalendarMinus size={14} />
              Compensar horas
            </Button>
          )}
        </div>
      </div>

      {/* Simulation Dialog */}
      <Dialog open={showSim} onOpenChange={setShowSim}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={18} />
              Simulação de valor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-warning/10 rounded-xl p-4 border border-warning/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Se não compensado, isso pode representar
              </p>
              <p className="text-3xl font-bold text-warning">
                ≈ {formatCurrency(summary.estimativaValor)}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Saldo total: {formatMinutosHoras(saldoFinal)}</p>
              <p>• Baseado nos dados informados pelo usuário</p>
              <p>• Valores são estimativas, não valores exatos</p>
              <p>• Consulte um profissional qualificado para análise</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compensação Dialog */}
      <Dialog open={showCompensacao} onOpenChange={setShowCompensacao}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarMinus size={18} />
              Compensar horas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Saldo disponível: <span className="font-bold text-foreground">{formatMinutosHoras(saldoFinal)}</span>
              {' '}({calcEquivDias(saldoFinal, cargaDiaria)})
            </p>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="compTipo" value="dia_completo" checked={compTipo === 'dia_completo'} onChange={() => setCompTipo('dia_completo')} className="accent-accent" />
                  Dia inteiro ({cargaDiaria}h)
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="compTipo" value="horas" checked={compTipo === 'horas'} onChange={() => setCompTipo('horas')} className="accent-accent" />
                  Horas específicas
                </label>
              </div>
            </div>

            {compTipo === 'horas' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
                  <Input type="number" min="0" value={compHoras} onChange={(e) => setCompHoras(e.target.value)} className="rounded-xl" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Minutos</label>
                  <Input type="number" min="0" max="59" value={compMinutos} onChange={(e) => setCompMinutos(e.target.value)} className="rounded-xl" placeholder="0" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data da folga/compensação</label>
              <Input type="date" value={compData} onChange={(e) => setCompData(e.target.value)} className="rounded-xl" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação (opcional)</label>
              <Input value={compObs} onChange={(e) => setCompObs(e.target.value)} className="rounded-xl" placeholder="Ex: folga compensatória" />
            </div>

            <Button
              onClick={handleCompensar}
              disabled={savingComp}
              className="w-full rounded-xl bg-accent text-accent-foreground"
            >
              {savingComp ? 'Salvando...' : 'Registrar compensação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BancoHorasCards;
