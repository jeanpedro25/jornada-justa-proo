import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { inserirMarcacaoManual, type TipoMarcacao } from '@/lib/jornada';

interface ManualEntryProps {
  onAdded: () => void;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ onAdded }) => {
  const { user, profile } = useAuth();
  const p = profile as any;

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [usaIntervalo, setUsaIntervalo] = useState(true);

  const entradaPadrao = p?.horario_entrada_padrao || '08:00';
  const saidaPadrao = p?.horario_saida_padrao || '17:00';
  const intervaloMin = p?.intervalo_almoco ?? 60;
  const cargaDiaria = p?.carga_horaria_diaria ?? 8;

  function calcDefaults() {
    if (intervaloMin > 0) {
      const halfWork = (cargaDiaria * 60) / 2;
      const saida1Default = addMinutesToTime(entradaPadrao, halfWork);
      const entrada2Default = addMinutesToTime(saida1Default, intervaloMin);
      return {
        entrada1: entradaPadrao,
        saida1: saida1Default,
        entrada2: entrada2Default,
        saida2: saidaPadrao,
      };
    }
    return { entrada1: entradaPadrao, saida1: saidaPadrao, entrada2: '', saida2: '' };
  }

  const defaults = calcDefaults();
  const [entrada1, setEntrada1] = useState(defaults.entrada1);
  const [saida1, setSaida1] = useState(defaults.saida1);
  const [entrada2, setEntrada2] = useState(defaults.entrada2);
  const [saida2, setSaida2] = useState(defaults.saida2);

  useEffect(() => {
    if (open) {
      const d = calcDefaults();
      setEntrada1(d.entrada1);
      setSaida1(d.saida1);
      setEntrada2(d.entrada2);
      setSaida2(d.saida2);
      setUsaIntervalo(intervaloMin > 0);
    }
  }, [open, p?.horario_entrada_padrao, p?.horario_saida_padrao, p?.intervalo_almoco]);

  const handleSave = async () => {
    if (!user || !date) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }
    if (!entrada1) {
      toast({ title: 'Informe o horário de entrada', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Create marcações based on the form
      const marcacoes: { tipo: TipoMarcacao; horario: string }[] = [];

      if (usaIntervalo && entrada2) {
        // 4 marcações: entrada → saida_intervalo → volta_intervalo → saida_final
        marcacoes.push({ tipo: 'entrada', horario: new Date(`${dateStr}T${entrada1}:00`).toISOString() });
        if (saida1) marcacoes.push({ tipo: 'saida_intervalo', horario: new Date(`${dateStr}T${saida1}:00`).toISOString() });
        marcacoes.push({ tipo: 'volta_intervalo', horario: new Date(`${dateStr}T${entrada2}:00`).toISOString() });
        if (saida2) marcacoes.push({ tipo: 'saida_final', horario: new Date(`${dateStr}T${saida2}:00`).toISOString() });
      } else {
        // 2 marcações: entrada → saida_final
        marcacoes.push({ tipo: 'entrada', horario: new Date(`${dateStr}T${entrada1}:00`).toISOString() });
        if (saida1) marcacoes.push({ tipo: 'saida_final', horario: new Date(`${dateStr}T${saida1}:00`).toISOString() });
      }

      for (const m of marcacoes) {
        await inserirMarcacaoManual(user.id, dateStr, m.tipo, m.horario);
      }

      toast({
        title: '✅ Registro manual adicionado!',
        description: `${format(date, "dd/MM/yyyy", { locale: ptBR })} — ${marcacoes.length} marcações`,
      });
      onAdded();
      setOpen(false);
      setDate(undefined);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2 text-xs w-full">
          <Plus size={14} />
          Adicionar registro manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registro manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            ⚠️ Registros manuais ficam marcados como editados.
          </p>

          {/* Date picker */}
          <div>
            <label className="text-sm font-medium mb-1 block">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d > new Date()}
                  locale={ptBR}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Toggle intervalo */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Jornada com intervalo</label>
            <Switch checked={usaIntervalo} onCheckedChange={setUsaIntervalo} />
          </div>

          {usaIntervalo ? (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">🟢 ENTRADA → 🟡 SAÍDA INTERVALO</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Entrada</label>
                    <Input type="time" value={entrada1} onChange={(e) => setEntrada1(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Saída intervalo</label>
                    <Input type="time" value={saida1} onChange={(e) => setSaida1(e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">🔵 VOLTA INTERVALO → 🔴 SAÍDA FINAL</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Volta</label>
                    <Input type="time" value={entrada2} onChange={(e) => setEntrada2(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Saída final</label>
                    <Input type="time" value={saida2} onChange={(e) => setSaida2(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Entrada</label>
                <Input type="time" value={entrada1} onChange={(e) => setEntrada1(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Saída final</label>
                <Input type="time" value={saida1} onChange={(e) => setSaida1(e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={loading || !date} className="w-full rounded-xl">
            {loading ? 'Salvando...' : 'Salvar registro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntry;
