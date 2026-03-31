import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Calendar, RotateCcw } from 'lucide-react';

interface JornadaConfigProps {
  tipoJornada: string;
  setTipoJornada: (v: string) => void;
  diasTrabalhados: string;
  setDiasTrabalhados: (v: string) => void;
  horarioEntrada: string;
  setHorarioEntrada: (v: string) => void;
  horarioSaida: string;
  setHorarioSaida: (v: string) => void;
  escalaTipo: string;
  setEscalaTipo: (v: string) => void;
  escalaDiasTrabalho: string;
  setEscalaDiasTrabalho: (v: string) => void;
  escalaDiasFolga: string;
  setEscalaDiasFolga: (v: string) => void;
  escalaInicio: string;
  setEscalaInicio: (v: string) => void;
  turnoAInicio: string;
  setTurnoAInicio: (v: string) => void;
  turnoAFim: string;
  setTurnoAFim: (v: string) => void;
  turnoBInicio: string;
  setTurnoBInicio: (v: string) => void;
  turnoBFim: string;
  setTurnoBFim: (v: string) => void;
  turnoCInicio: string;
  setTurnoCInicio: (v: string) => void;
  turnoCFim: string;
  setTurnoCFim: (v: string) => void;
  alternanciaTurno: string;
  setAlternanciaTurno: (v: string) => void;
}

const JornadaConfig: React.FC<JornadaConfigProps> = ({
  tipoJornada, setTipoJornada,
  diasTrabalhados, setDiasTrabalhados,
  horarioEntrada, setHorarioEntrada,
  horarioSaida, setHorarioSaida,
  escalaTipo, setEscalaTipo,
  escalaDiasTrabalho, setEscalaDiasTrabalho,
  escalaDiasFolga, setEscalaDiasFolga,
  escalaInicio, setEscalaInicio,
  turnoAInicio, setTurnoAInicio,
  turnoAFim, setTurnoAFim,
  turnoBInicio, setTurnoBInicio,
  turnoBFim, setTurnoBFim,
  turnoCInicio, setTurnoCInicio,
  turnoCFim, setTurnoCFim,
  alternanciaTurno, setAlternanciaTurno,
}) => {
  const handleEscalaTipo = (v: string) => {
    setEscalaTipo(v);
    if (v === '5x2') { setEscalaDiasTrabalho('5'); setEscalaDiasFolga('2'); }
    else if (v === '6x1') { setEscalaDiasTrabalho('6'); setEscalaDiasFolga('1'); }
    else if (v === '12x36') { setEscalaDiasTrabalho('1'); setEscalaDiasFolga('1'); }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Briefcase size={16} className="text-accent" />
        <span className="font-semibold text-sm">Tipo de Jornada</span>
      </div>

      <Select value={tipoJornada} onValueChange={setTipoJornada}>
        <SelectTrigger className="rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="jornada_fixa">Jornada fixa</SelectItem>
          <SelectItem value="escala">Escala</SelectItem>
          <SelectItem value="turno">Turno</SelectItem>
        </SelectContent>
      </Select>

      {/* JORNADA FIXA */}
      {tipoJornada === 'jornada_fixa' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dias trabalhados por semana</label>
            <Input type="number" value={diasTrabalhados} onChange={(e) => setDiasTrabalhados(e.target.value)} className="rounded-xl" placeholder="5" min="1" max="7" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Entrada padrão</label>
              <Input type="time" value={horarioEntrada} onChange={(e) => setHorarioEntrada(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Saída padrão</label>
              <Input type="time" value={horarioSaida} onChange={(e) => setHorarioSaida(e.target.value)} className="rounded-xl" />
            </div>
          </div>
        </>
      )}

      {/* ESCALA */}
      {tipoJornada === 'escala' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              <Calendar size={12} className="inline mr-1" />
              Tipo de escala
            </label>
            <Select value={escalaTipo} onValueChange={handleEscalaTipo}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5x2">5×2 (seg–sex)</SelectItem>
                <SelectItem value="6x1">6×1</SelectItem>
                <SelectItem value="12x36">12×36</SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {escalaTipo === '12x36' && (
            <p className="text-[10px] text-muted-foreground">
              Jornada de 12h com 36h de folga. O app calcula extras após 12h.
            </p>
          )}

          {escalaTipo === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dias trabalho</label>
                <Input type="number" value={escalaDiasTrabalho} onChange={(e) => setEscalaDiasTrabalho(e.target.value)} className="rounded-xl" placeholder="5" min="1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dias folga</label>
                <Input type="number" value={escalaDiasFolga} onChange={(e) => setEscalaDiasFolga(e.target.value)} className="rounded-xl" placeholder="2" min="1" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data início da escala</label>
            <Input type="date" value={escalaInicio} onChange={(e) => setEscalaInicio(e.target.value)} className="rounded-xl" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Usado para calcular se hoje é dia de trabalho ou folga.
            </p>
          </div>
        </>
      )}

      {/* TURNO */}
      {tipoJornada === 'turno' && (
        <>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-semibold">Turno A</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                <Input type="time" value={turnoAInicio} onChange={(e) => setTurnoAInicio(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                <Input type="time" value={turnoAFim} onChange={(e) => setTurnoAFim(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-semibold">Turno B</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                <Input type="time" value={turnoBInicio} onChange={(e) => setTurnoBInicio(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                <Input type="time" value={turnoBFim} onChange={(e) => setTurnoBFim(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-semibold">Turno C (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                <Input type="time" value={turnoCInicio} onChange={(e) => setTurnoCInicio(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                <Input type="time" value={turnoCFim} onChange={(e) => setTurnoCFim(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              <RotateCcw size={12} className="inline mr-1" />
              Alternância
            </label>
            <Select value={alternanciaTurno} onValueChange={setAlternanciaTurno}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (você escolhe)</SelectItem>
                <SelectItem value="auto">Automático (semanal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <p className="text-[10px] text-muted-foreground/50 text-center">
        Os cálculos são estimativas baseadas nas configurações definidas pelo usuário.
      </p>
    </div>
  );
};

export default JornadaConfig;
