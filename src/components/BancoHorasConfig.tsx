import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BancoHorasConfigProps {
  modoTrabalho: string;
  setModoTrabalho: (v: string) => void;
  prazo: string;
  setPrazo: (v: string) => void;
  conversao: string;
  setConversao: (v: string) => void;
  limite: string;
  setLimite: (v: string) => void;
}

function calcularEquivalenciaDias(horas: number, minutos: number, cargaDiariaHoras: number): string {
  if (cargaDiariaHoras <= 0) return '';
  const totalMin = horas * 60 + minutos;
  if (totalMin === 0) return '';
  const diasExatos = totalMin / (cargaDiariaHoras * 60);
  if (diasExatos === Math.floor(diasExatos)) {
    return `${diasExatos} dia${diasExatos !== 1 ? 's' : ''} de trabalho`;
  }
  const diasInteiros = Math.floor(diasExatos);
  const horasRestantes = ((diasExatos - diasInteiros) * cargaDiariaHoras).toFixed(2);
  if (diasInteiros === 0) return `${horasRestantes}h`;
  return `${diasInteiros} dia${diasInteiros !== 1 ? 's' : ''} e ${horasRestantes}h`;
}

const BancoHorasConfig: React.FC<BancoHorasConfigProps> = ({
  modoTrabalho, setModoTrabalho, prazo, setPrazo, conversao, setConversao, limite, setLimite,
}) => {
  const { user, profile } = useAuth();
  const p = profile as any;

  const [saldoTipo, setSaldoTipo] = useState<'nenhum' | 'positivo' | 'negativo'>('nenhum');
  const [saldoHoras, setSaldoHoras] = useState('');
  const [saldoMinutos, setSaldoMinutos] = useState('');
  const [saldoData, setSaldoData] = useState('');
  const [savingSaldo, setSavingSaldo] = useState(false);

  const cargaDiaria = p?.carga_horaria_diaria ?? 8;

  useEffect(() => {
    if (p) {
      const saldoInicial = p.banco_horas_saldo_inicial ?? 0;
      if (saldoInicial > 0) {
        setSaldoTipo('positivo');
        setSaldoHoras(String(Math.floor(saldoInicial / 60)));
        setSaldoMinutos(String(saldoInicial % 60));
      } else if (saldoInicial < 0) {
        setSaldoTipo('negativo');
        setSaldoHoras(String(Math.floor(Math.abs(saldoInicial) / 60)));
        setSaldoMinutos(String(Math.abs(saldoInicial) % 60));
      } else {
        setSaldoTipo('nenhum');
        setSaldoHoras('');
        setSaldoMinutos('');
      }
      setSaldoData(p.banco_horas_saldo_inicial_data || '');
    }
  }, [p]);

  const equivalencia = calcularEquivalenciaDias(
    Number(saldoHoras) || 0,
    Number(saldoMinutos) || 0,
    cargaDiaria
  );

  const handleSalvarSaldo = async () => {
    if (!user) return;
    setSavingSaldo(true);
    const totalMin = (Number(saldoHoras) || 0) * 60 + (Number(saldoMinutos) || 0);
    const valor = saldoTipo === 'negativo' ? -totalMin : saldoTipo === 'positivo' ? totalMin : 0;
    const { error } = await supabase.from('profiles').update({
      banco_horas_saldo_inicial: valor,
      banco_horas_saldo_inicial_data: saldoData || null,
    } as any).eq('id', user.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saldo inicial salvo!' });
    }
    setSavingSaldo(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={16} className="text-accent" />
        <span className="font-semibold text-sm">Banco de Horas</span>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Tipo de jornada</label>
        <Select value={modoTrabalho} onValueChange={setModoTrabalho}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="horas_extras">Horas extras pagas</SelectItem>
            <SelectItem value="banco_horas">Banco de horas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {modoTrabalho === 'banco_horas' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prazo de compensação</label>
            <Select value={prazo} onValueChange={setPrazo}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">3 meses</SelectItem>
                <SelectItem value="180">6 meses</SelectItem>
                <SelectItem value="365">12 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {prazo === 'custom' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dias para compensar</label>
              <Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} className="rounded-xl" placeholder="Ex: 120" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Regra de conversão</label>
            <Select value={conversao} onValueChange={setConversao}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1x">Hora normal (1x)</SelectItem>
                <SelectItem value="1.5x">Hora extra 50% (1.5x)</SelectItem>
                <SelectItem value="2x">Hora extra 100% (2x)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Limite do banco (horas, opcional)</label>
            <Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} className="rounded-xl" placeholder="Ex: 40" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Deixe vazio para sem limite. Valor em horas.
            </p>
          </div>

          {/* Saldo Inicial */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">SALDO INICIAL</p>
            <p className="text-[10px] text-muted-foreground">
              Você já tem horas acumuladas antes de começar a usar o Hora Justa?
            </p>

            <div className="space-y-2">
              {(['nenhum', 'positivo', 'negativo'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="saldoTipo"
                    value={opt}
                    checked={saldoTipo === opt}
                    onChange={() => setSaldoTipo(opt)}
                    className="accent-accent"
                  />
                  {opt === 'nenhum' && 'Não tenho saldo anterior'}
                  {opt === 'positivo' && 'Tenho horas a receber do patrão'}
                  {opt === 'negativo' && 'Devo horas para a empresa'}
                </label>
              ))}
            </div>

            {saldoTipo !== 'nenhum' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Horas</label>
                    <Input
                      type="number"
                      min="0"
                      value={saldoHoras}
                      onChange={(e) => setSaldoHoras(e.target.value)}
                      className="rounded-xl"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Minutos</label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={saldoMinutos}
                      onChange={(e) => setSaldoMinutos(e.target.value)}
                      className="rounded-xl"
                      placeholder="0"
                    />
                  </div>
                </div>

                {equivalencia && (
                  <p className="text-xs text-accent">
                    → Equivale a: {equivalencia} (baseado na sua carga de {cargaDiaria}h/dia)
                  </p>
                )}

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data de referência</label>
                  <Input
                    type="date"
                    value={saldoData}
                    onChange={(e) => setSaldoData(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Data em que você contabilizou esse saldo.
                  </p>
                </div>

                <Button
                  onClick={handleSalvarSaldo}
                  disabled={savingSaldo}
                  className="w-full rounded-xl bg-accent text-accent-foreground text-sm"
                >
                  {savingSaldo ? 'Salvando...' : 'Salvar saldo inicial'}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BancoHorasConfig;
