import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodoTipo = 'hoje' | 'semana' | 'mes' | 'ciclo' | 'personalizado' | 'tudo';
export type TipoRelatorio = 'resumido' | 'completo';

export interface ReportOptions {
  periodo: PeriodoTipo;
  dataInicio?: Date;
  dataFim?: Date;
  tipo: TipoRelatorio;
  incluirBancoHoras: boolean;
  incluirEventos: boolean;
  incluirAnexos: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (options: ReportOptions) => void;
  generating: boolean;
  cicloLabel?: string;
}

const ReportOptionsModal: React.FC<Props> = ({ open, onOpenChange, onGenerate, generating, cicloLabel }) => {
  const [periodo, setPeriodo] = useState<PeriodoTipo>(cicloLabel ? 'ciclo' : 'mes');
  const [tipo, setTipo] = useState<TipoRelatorio>('completo');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [incluirBancoHoras, setIncluirBancoHoras] = useState(true);
  const [incluirEventos, setIncluirEventos] = useState(true);
  const [incluirAnexos, setIncluirAnexos] = useState(false);

  const canGenerate = periodo !== 'personalizado' || (dataInicio && dataFim);

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate({
      periodo,
      dataInicio,
      dataFim,
      tipo,
      incluirBancoHoras,
      incluirEventos,
      incluirAnexos,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} className="text-accent" />
            Gerar Relatório PDF
          </DialogTitle>
          <DialogDescription>Configure as opções do seu relatório antes de gerar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Período */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">📅 Período</Label>
            <RadioGroup value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoTipo)} className="space-y-1">
              {[
                { value: 'hoje', label: 'Hoje' },
                { value: 'semana', label: 'Esta semana' },
                { value: 'mes', label: 'Este mês' },
                ...(cicloLabel ? [{ value: 'ciclo', label: `📑 ${cicloLabel}` }] : []),
                { value: 'personalizado', label: 'Personalizado' },
                { value: 'tudo', label: 'Todo o histórico' },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`periodo-${opt.value}`} />
                  <Label htmlFor={`periodo-${opt.value}`} className="cursor-pointer text-sm font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {periodo === 'personalizado' && (
              <div className="flex gap-2 mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 justify-start text-left text-xs', !dataInicio && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : 'Início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 justify-start text-left text-xs', !dataFim && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">📋 Tipo de relatório</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as TipoRelatorio)} className="space-y-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="resumido" id="tipo-resumido" />
                <Label htmlFor="tipo-resumido" className="cursor-pointer text-sm font-normal">Resumido</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="completo" id="tipo-completo" />
                <Label htmlFor="tipo-completo" className="cursor-pointer text-sm font-normal">Completo (detalhado)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Opções avançadas */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">⚙️ Opções avançadas</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="opt-banco" checked={incluirBancoHoras} onCheckedChange={(v) => setIncluirBancoHoras(!!v)} />
                <Label htmlFor="opt-banco" className="cursor-pointer text-sm font-normal">Incluir banco de horas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="opt-eventos" checked={incluirEventos} onCheckedChange={(v) => setIncluirEventos(!!v)} />
                <Label htmlFor="opt-eventos" className="cursor-pointer text-sm font-normal">Incluir eventos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="opt-anexos" checked={incluirAnexos} onCheckedChange={(v) => setIncluirAnexos(!!v)} />
                <Label htmlFor="opt-anexos" className="cursor-pointer text-sm font-normal">Incluir anexos</Label>
              </div>
            </div>
          </div>

          {/* Gerar */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold gap-2"
          >
            {generating ? (
              <><Loader2 size={18} className="animate-spin" /> Gerando...</>
            ) : (
              <><FileText size={18} /> Gerar relatório</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportOptionsModal;
