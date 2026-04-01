import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchBancoHorasEntries, 
  summarizeBancoHoras, 
  formatMinutosHoras, 
  type BancoHorasSummary 
} from '@/lib/banco-horas';
import { formatCurrency } from '@/lib/formatters';
import { Clock, TrendingUp, AlertTriangle, DollarSign, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BancoHorasCards: React.FC = () => {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<BancoHorasSummary | null>(null);
  const [showSim, setShowSim] = useState(false);

  const load = useCallback(async () => {
    if (!user || !profile) return;
    const entries = await fetchBancoHorasEntries(user.id);
    const s = summarizeBancoHoras(
      entries,
      profile.salario_base ?? 0,
      profile.hora_extra_percentual ?? 50,
    );
    setSummary(s);
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  if (!summary || (profile as any)?.modo_trabalho !== 'banco_horas') return null;

  const saldoPositivo = summary.saldo >= 0;

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground px-1">BANCO DE HORAS</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Saldo */}
          <div className={`rounded-xl p-4 border ${
            saldoPositivo ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className={saldoPositivo ? 'text-success' : 'text-destructive'} />
              <p className="text-[10px] text-muted-foreground uppercase">Saldo atual</p>
            </div>
            <p className={`text-lg font-bold ${saldoPositivo ? 'text-success' : 'text-destructive'}`}>
              {formatMinutosHoras(summary.saldo)}
            </p>
          </div>

          {/* A compensar */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase">Compensado</p>
            </div>
            <p className="text-lg font-bold">
              {summary.aCompensar > 0 ? formatMinutosHoras(-summary.aCompensar) : '—'}
            </p>
          </div>

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

        {/* Simulate button */}
        {summary.saldo > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl gap-2 text-xs"
            onClick={() => setShowSim(true)}
          >
            <Calculator size={14} />
            Simular valor do banco de horas
          </Button>
        )}
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
              <p>• Saldo atual: {formatMinutosHoras(summary.saldo)}</p>
              <p>• Baseado nos dados informados pelo usuário</p>
              <p>• Valores são estimativas, não valores exatos</p>
              <p>• Consulte um profissional qualificado para análise</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BancoHorasCards;
