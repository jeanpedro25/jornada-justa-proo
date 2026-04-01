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
  const [entradaTime, setEntradaTime] = useState('08:00');
  const [saidaTime, setSaidaTime] = useState('17:00');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user || !date) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }
    if (!entradaTime) {
      toast({ title: 'Informe o horário de entrada', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const entrada = new Date(`${dateStr}T${entradaTime}:00`).toISOString();
    const saida = saidaTime ? new Date(`${dateStr}T${saidaTime}:00`).toISOString() : null;

    const insertData: any = {
      user_id: user.id,
      data: dateStr,
      entrada,
      saida,
      intervalo_minutos: 0,
      editado_manualmente: true,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    };

    const { error } = await supabase.from('registros_ponto').insert(insertData);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Registro manual adicionado!', description: `${format(date, "dd/MM/yyyy", { locale: ptBR })} — ${entradaTime}${saidaTime ? ` → ${saidaTime}` : ''}` });
      onAdded();
      setOpen(false);
      setDate(undefined);
      setEntradaTime('08:00');
      setSaidaTime('17:00');
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

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Entrada</label>
              <Input
                type="time"
                value={entradaTime}
                onChange={(e) => setEntradaTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saída (opcional)</label>
              <Input
                type="time"
                value={saidaTime}
                onChange={(e) => setSaidaTime(e.target.value)}
              />
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
