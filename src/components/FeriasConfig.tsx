import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Palmtree, Plus, Trash2 } from 'lucide-react';

interface Ferias {
  id: string;
  data_inicio: string;
  data_fim: string;
  dias_direito: number;
  tipo: string;
  status: string;
  observacao: string | null;
  created_at: string;
}

function calcDias(inicio: string, fim: string): number {
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(fim + 'T12:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

function autoStatus(f: Ferias): Ferias {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const inicio = new Date(f.data_inicio + 'T12:00:00');
  const fim = new Date(f.data_fim + 'T12:00:00');
  let status = f.status;
  if (hoje > fim) status = 'concluida';
  else if (hoje >= inicio && hoje <= fim) status = 'ativa';
  else if (hoje < inicio) status = 'agendada';
  return { ...f, status };
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

const FeriasConfig: React.FC = () => {
  const { user, profile } = useAuth();
  const p = profile as any;
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [tipo, setTipo] = useState('normal');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (p?.data_admissao) setDataAdmissao(p.data_admissao);
  }, [p]);

  const fetchFerias = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ferias' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('data_inicio', { ascending: false });
    setFerias((data as any as Ferias[]) || []);
  };

  useEffect(() => { fetchFerias(); }, [user]);

  const saveAdmissao = async (val: string) => {
    setDataAdmissao(val);
    if (!user || !val) return;
    await supabase.from('profiles').update({ data_admissao: val } as any).eq('id', user.id);
  };

  const handleAgendar = async () => {
    if (!user || !inicio || !fim) return;
    const dias = calcDias(inicio, fim);
    if (dias < 1) {
      toast({ title: 'Data inválida', description: 'A data fim deve ser após a data início.', variant: 'destructive' });
      return;
    }
    if (tipo === 'fracionada' && dias < 14) {
      toast({ title: 'Mínimo 14 dias', description: 'Férias fracionadas devem ter no mínimo 14 dias corridos.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ferias' as any).insert({
      user_id: user.id,
      data_inicio: inicio,
      data_fim: fim,
      dias_direito: 30,
      tipo,
      status: 'agendada',
      observacao: obs.trim() || null,
    } as any);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🏖 Férias agendadas!' });
      setInicio(''); setFim(''); setObs(''); setShowForm(false);
      fetchFerias();
    }
    setSaving(false);
  };

  const handleCancelar = async (id: string) => {
    if (!confirm('Cancelar este período de férias?')) return;
    await supabase.from('ferias' as any).delete().eq('id', id);
    fetchFerias();
    toast({ title: 'Férias canceladas' });
  };

  // Cálculo de situação
  const diasTirados = ferias
    .filter(f => f.status === 'concluida')
    .reduce((acc, f) => acc + calcDias(f.data_inicio, f.data_fim), 0);
  const diasRestantes = Math.max(0, 30 - diasTirados);

  let vencida = false;
  let diasAteVencer = 0;
  let periodoAquisitivoStr = '';
  if (dataAdmissao) {
    const adm = new Date(dataAdmissao + 'T12:00:00');
    const fimPeriodo = new Date(adm);
    fimPeriodo.setFullYear(fimPeriodo.getFullYear() + 1);
    const vencimento = new Date(fimPeriodo);
    vencimento.setFullYear(vencimento.getFullYear() + 1);
    periodoAquisitivoStr = `${formatDate(dataAdmissao)} – ${formatDate(fimPeriodo.toISOString().split('T')[0])}`;
    diasAteVencer = Math.round((vencimento.getTime() - Date.now()) / 86400000);
    vencida = diasAteVencer < 0 && diasRestantes > 0;
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'agendada': return 'bg-warning/20 text-warning';
      case 'ativa': return 'bg-accent/20 text-accent';
      case 'concluida': return 'bg-success/20 text-success';
      case 'vencida': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusLabel: Record<string, string> = {
    agendada: '🟡 Agendada',
    ativa: '🟢 Ativa',
    concluida: '✅ Concluída',
    vencida: '🔴 Vencida',
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Palmtree size={16} className="text-accent" />
        <span className="font-semibold text-sm">Férias</span>
      </div>

      {/* Data de admissão */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Data de admissão</label>
        <Input
          type="date"
          value={dataAdmissao}
          onChange={(e) => saveAdmissao(e.target.value)}
          className="rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Necessária para calcular período aquisitivo e vencimento.
        </p>
      </div>

      {/* Situação */}
      {dataAdmissao && (
        <div className="bg-secondary rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">SITUAÇÃO DAS FÉRIAS</p>
          <p className="text-xs">
            <span className="text-muted-foreground">Período aquisitivo:</span>{' '}
            <span className="font-medium">{periodoAquisitivoStr}</span>
          </p>
          {vencida ? (
            <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full bg-destructive/20 text-destructive">
              ⚠️ Férias VENCIDAS · {Math.abs(diasAteVencer)} dias atrás
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full bg-success/20 text-success">
                {diasRestantes} dias disponíveis
              </span>
              {diasAteVencer > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Vencem em {diasAteVencer} dias
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulário */}
      {showForm ? (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold">Agendar período de férias</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Início</label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          {inicio && fim && calcDias(inicio, fim) > 0 && (
            <p className="text-xs text-muted-foreground">{calcDias(inicio, fim)} dias corridos</p>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="tipoFerias" value="normal" checked={tipo === 'normal'} onChange={() => setTipo('normal')} className="accent-accent" />
                Completas (30 dias)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" name="tipoFerias" value="fracionada" checked={tipo === 'fracionada'} onChange={() => setTipo('fracionada')} className="accent-accent" />
                Fracionadas (mín. 14 dias)
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observação (opcional)</label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} className="rounded-xl" placeholder="Ex: férias de julho" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAgendar} disabled={saving} className="flex-1 rounded-xl bg-accent text-accent-foreground text-sm">
              {saving ? 'Salvando...' : '🏖 Agendar férias'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-sm">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="w-full rounded-xl gap-2 text-sm">
          <Plus size={14} /> Agendar período de férias
        </Button>
      )}

      {/* Lista */}
      {ferias.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">PERÍODOS REGISTRADOS</p>
          {ferias.map(f => (
            <div key={f.id} className="bg-secondary rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(f.status)}`}>
                  {statusLabel[f.status] || f.status}
                </span>
                <p className="text-xs mt-1">
                  {formatDate(f.data_inicio)} – {formatDate(f.data_fim)} · {calcDias(f.data_inicio, f.data_fim)} dias
                </p>
                {f.observacao && <p className="text-[10px] text-muted-foreground mt-0.5">{f.observacao}</p>}
              </div>
              {f.status === 'agendada' && (
                <Button variant="ghost" size="icon" onClick={() => handleCancelar(f.id)} className="text-destructive h-8 w-8">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        ⚠️ Estimativa baseada em dados informados pelo usuário. Não substitui controle oficial da empresa.
      </p>
    </div>
  );
};

export default FeriasConfig;
