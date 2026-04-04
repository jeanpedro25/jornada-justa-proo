import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';

interface EditRegistroProps {
  registroId: string;
  entrada: string;
  saida: string | null;
  onEdited: () => void;
}

const EditRegistro: React.FC<EditRegistroProps> = ({ registroId, entrada, saida, onEdited }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entradaTime, setEntradaTime] = useState(
    new Date(entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  const [saidaTime, setSaidaTime] = useState(
    saida ? new Date(saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    const dateStr = new Date(entrada).toISOString().split('T')[0];
    const newEntrada = new Date(`${dateStr}T${entradaTime}:00`).toISOString();
    const newSaida = saidaTime ? new Date(`${dateStr}T${saidaTime}:00`).toISOString() : null;

    const updateData: any = {
      entrada: newEntrada,
      saida: newSaida,
      editado_manualmente: true,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    };

    const { error } = await supabase
      .from('registros_ponto')
      .update(updateData)
      .eq('id', registroId)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro editado!', description: 'Horários atualizados com sucesso.' });
      onEdited();
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 rounded-lg text-xs h-7 px-2">
          <Pencil size={12} />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            ⚠️ Edições manuais ficam registradas como prova.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Entrada</label>
              <Input
                type="time"
                value={entradaTime}
                onChange={(e) => setEntradaTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saída</label>
              <Input
                type="time"
                value={saidaTime}
                onChange={(e) => setSaidaTime(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-xl"
          >
            {loading ? 'Salvando...' : 'Salvar alteração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditRegistro;
