import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';

interface BancoHorasConfigProps {
  modoTrabalho: string;
  setModoTrabalho: (v: string) => void;
  prazo: string;
  setPrazo: (v: string) => void;
  conversao: string;
  setConversao: (v: string) => void;
  limite: string;
  setLimite: (v: string) => void;
  prazoDiasCustom?: string;
  setPrazoDiasCustom?: (v: string) => void;
}

const BancoHorasConfig: React.FC<BancoHorasConfigProps> = ({
  modoTrabalho, setModoTrabalho, prazo, setPrazo, conversao, setConversao, limite, setLimite,
}) => {
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
        </>
      )}
    </div>
  );
};

export default BancoHorasConfig;
