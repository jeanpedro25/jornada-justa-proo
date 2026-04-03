import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, MapPin, Calendar } from 'lucide-react';
import { getFeriadosDoAno } from '@/lib/feriados';

interface FeriadoLocal {
  id: string;
  data: string;
  nome: string;
  recorrente: boolean;
}

const FeriadosLocaisConfig: React.FC = () => {
  const { user } = useAuth();
  const [feriados, setFeriados] = useState<FeriadoLocal[]>([]);
  const [novaData, setNovaData] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoRecorrente, setNovoRecorrente] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const anoAtual = new Date().getFullYear();
  const nacionais = getFeriadosDoAno(anoAtual);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('feriados_locais')
      .select('*')
      .eq('user_id', user.id)
      .order('data', { ascending: true })
      .then(({ data }) => {
        if (data) setFeriados(data as FeriadoLocal[]);
      });
  }, [user]);

  const adicionar = async () => {
    if (!user || !novaData || !novoNome.trim()) {
      toast({ title: 'Preencha a data e o nome do feriado', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('feriados_locais')
      .insert({ user_id: user.id, data: novaData, nome: novoNome.trim(), recorrente: novoRecorrente })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else if (data) {
      setFeriados(prev => [...prev, data as FeriadoLocal]);
      setNovaData('');
      setNovoNome('');
      setNovoRecorrente(true);
      setShowForm(false);
      toast({ title: '✅ Feriado local adicionado' });
    }
    setLoading(false);
  };

  const remover = async (id: string) => {
    await supabase.from('feriados_locais').delete().eq('id', id);
    setFeriados(prev => prev.filter(f => f.id !== id));
    toast({ title: 'Feriado removido' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={16} className="text-accent" />
        <h3 className="font-semibold text-sm">Feriados</h3>
      </div>

      {/* Nacionais - apenas listagem */}
      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
          <Calendar size={12} />
          {nacionais.length} feriados nacionais em {anoAtual} (automático)
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          {nacionais.map(f => (
            <div key={f.data} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums w-12">
                {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span>{f.nome}</span>
            </div>
          ))}
        </div>
      </details>

      {/* Locais do usuário */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Feriados da sua cidade ou estado:</p>

        {feriados.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground/60 italic">Nenhum feriado local cadastrado</p>
        )}

        {feriados.map(f => (
          <div key={f.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{f.nome}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                {f.recorrente && ' · repete todo ano'}
              </p>
            </div>
            <button onClick={() => remover(f.id)} className="text-destructive/60 hover:text-destructive p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {showForm ? (
          <div className="bg-secondary/30 rounded-xl p-3 space-y-3 border border-border">
            <Input
              type="date"
              value={novaData}
              onChange={e => setNovaData(e.target.value)}
              className="h-9 text-xs rounded-lg"
              placeholder="Data"
            />
            <Input
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              className="h-9 text-xs rounded-lg"
              placeholder="Ex: Aniversário da cidade"
            />
            <div className="flex items-center gap-2">
              <Switch checked={novoRecorrente} onCheckedChange={setNovoRecorrente} />
              <span className="text-xs text-muted-foreground">Repete todo ano</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={adicionar} disabled={loading} className="flex-1 h-8 text-xs">
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-8 text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="w-full h-8 text-xs gap-1">
            <Plus size={14} /> Adicionar feriado local
          </Button>
        )}
      </div>
    </div>
  );
};

export default FeriadosLocaisConfig;
