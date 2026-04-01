import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface ManualEntryProps {
  onAdded: () => void;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ onAdded }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [entrada1, setEntrada1] = useState('08:00');
  const [saida1, setSaida1] = useState('12:00');
  const [entrada2, setEntrada2] = useState('13:00');
  const [saida2, setSaida2] = useState('17:00');
  const [loading, setLoading] = useState(false);

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
    const now = new Date().toISOString();

    const periodos: Array<{
      user_id: string;
      data: string;
      entrada: string;
      saida: string | null;
      intervalo_minutos: number;
      editado_manualmente: boolean;
      editado_em: string;
      editado_por: string;
    }> = [];

    // Período 1 (manhã)
    if (entrada1) {
      periodos.push({
        user_id: user.id,
        data: dateStr,
        entrada: new Date(`${dateStr}T${entrada1}:00`).toISOString(),
        saida: saida1 ? new Date(`${dateStr}T${saida1}:00`).toISOString() : null,
        intervalo_minutos: 0,
        editado_manualmente: true,
        editado_em: now,
        editado_por: user.id,
      });
    }

    // Período 2 (tarde)
    if (entrada2) {
      periodos.push({
        user_id: user.id,
        data: dateStr,
        entrada: new Date(`${dateStr}T${entrada2}:00`).toISOString(),
        saida: saida2 ? new Date(`${dateStr}T${saida2}:00`).toISOString() : null,
        intervalo_minutos: 0,
        editado_manualmente: true,
        editado_em: now,
        editado_por: user.id,
      });
    }

    const { error } = await supabase.from('registros_ponto').insert(periodos);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: '✅ Registro manual adicionado!',
        description: `${format(date, "dd/MM/yyyy", { locale: ptBR })} — ${periodos.length} período(s)`,
      });
      onAdded();
      setOpen(false);
      setDate(undefined);
      setEntrada1('08:00');
      setSaida1('12:00');
      setEntrada2('13:00');
      setSaida2('17:00');
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
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
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

          {/* Período 1 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">PERÍODO 1 — Manhã</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Entrada</label>
                <Input type="time" value={entrada1} onChange={(e) => setEntrada1(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Saída</label>
                <Input type="time" value={saida1} onChange={(e) => setSaida1(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Período 2 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">PERÍODO 2 — Tarde</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Entrada</label>
                <Input type="time" value={entrada2} onChange={(e) => setEntrada2(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Saída</label>
                <Input type="time" value={saida2} onChange={(e) => setSaida2(e.target.value)} />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading || !date}
            className="w-full rounded-xl"
          >
            {loading ? 'Salvando...' : 'Salvar registro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntry;
