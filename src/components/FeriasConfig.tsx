import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Palmtree, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';

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
  if (status === 'cancelada') return f;
  if (hoje > fim) status = 'concluida';
  else if (hoje >= inicio && hoje <= fim) status = 'ativa';
  else if (hoje < inicio) status = 'agendada';
  return { ...f, status };
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function calcProgresso(inicio: string, fim: string): number {
  const hoje = new Date();
  const di = new Date(inicio + 'T12:00:00');
  const df = new Date(fim + 'T12:00:00');
  const total = (df.getTime() - di.getTime()) / 86400000;
  const passados = Math.max(0, Math.min(total, (hoje.getTime() - di.getTime()) / 86400000));
  return total > 0 ? Math.round((passados / total) * 100) : 0;
}

function diasPassados(inicio: string): number {
  const hoje = new Date();
  const di = new Date(inicio + 'T12:00:00');
  return Math.max(0, Math.round((hoje.getTime() - di.getTime()) / 86400000));
}

function diasAte(data: string): number {
  const hoje = new Date();
  const d = new Date(data + 'T12:00:00');
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
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

  // Edit modal
  const [editFerias, setEditFerias] = useState<Ferias | null>(null);
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editTipo, setEditTipo] = useState('normal');
  const [editObs, setEditObs] = useState('');

  // Cancel modal
  const [cancelFerias, setCancelFerias] = useState<Ferias | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

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
    setFerias(((data as any as Ferias[]) || []).map(autoStatus));
  };

  useEffect(() => { fetchFerias(); }, [user]);

  const saveAdmissao = async (val: string) => {
    setDataAdmissao(val);
    if (!user || !val) return;
    await supabase.from('profiles').update({ data_admissao: val } as any).eq('id', user.id);
  };

  const feriasAtivas = ferias.filter(f => f.status !== 'cancelada');
  const diasTirados = feriasAtivas.filter(f => f.status === 'concluida').reduce((acc, f) => acc + calcDias(f.data_inicio, f.data_fim), 0);
  const diasAgendados = feriasAtivas.filter(f => f.status === 'agendada' || f.status === 'ativa').reduce((acc, f) => acc + calcDias(f.data_inicio, f.data_fim), 0);
  const diasRestantes = Math.max(0, 30 - diasTirados - diasAgendados);

  const validarPeriodo = (ini: string, fi: string, editandoId?: string) => {
    const erros: string[] = [];
    const avisos: string[] = [];
    const dias = calcDias(ini, fi);

    if (dias < 1) erros.push('Data de fim deve ser após a data de início.');
    if (dias < 14) erros.push(`Mínimo de 14 dias por período (Art. 134 CLT). Selecionado: ${dias} dias.`);
    
    const disponivelParaEste = editandoId
      ? diasRestantes + calcDias(ferias.find(f => f.id === editandoId)!.data_inicio, ferias.find(f => f.id === editandoId)!.data_fim)
      : diasRestantes;
    if (dias > disponivelParaEste) erros.push(`Você tem apenas ${disponivelParaEste} dias disponíveis. Selecionado: ${dias} dias.`);

    const conflito = feriasAtivas.find(f =>
      f.id !== editandoId && ini <= f.data_fim && fi >= f.data_inicio
    );
    if (conflito) erros.push(`Conflito com período: ${formatDate(conflito.data_inicio)} – ${formatDate(conflito.data_fim)}.`);

    if (new Date(ini) < new Date()) avisos.push('A data de início está no passado.');
    if (dias > 30) avisos.push('Período acima de 30 dias. Verifique com seu RH.');

    return { valido: erros.length === 0, erros, avisos };
  };

  const handleAgendar = async () => {
    if (!user || !inicio || !fim) return;
    const v = validarPeriodo(inicio, fim);
    if (!v.valido) {
      toast({ title: 'Erro', description: v.erros.join(' '), variant: 'destructive' });
      return;
    }
    if (v.avisos.length > 0) {
      toast({ title: '⚠️ Atenção', description: v.avisos.join(' ') });
    }
    setSaving(true);
    const { error } = await supabase.from('ferias' as any).insert({
      user_id: user.id, data_inicio: inicio, data_fim: fim,
      dias_direito: 30, tipo, status: 'agendada',
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

  const openEdit = (f: Ferias) => {
    setEditFerias(f);
    setEditInicio(f.data_inicio);
    setEditFim(f.data_fim);
    setEditTipo(f.tipo);
    setEditObs(f.observacao || '');
  };

  const handleSaveEdit = async () => {
    if (!editFerias || !editInicio || !editFim) return;
    const v = validarPeriodo(editInicio, editFim, editFerias.id);
    if (!v.valido) {
      toast({ title: 'Erro', description: v.erros.join(' '), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ferias' as any).update({
      data_inicio: editInicio, data_fim: editFim, tipo: editTipo,
      observacao: editObs.trim() || null,
    } as any).eq('id', editFerias.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Férias atualizadas!' });
      setEditFerias(null);
      fetchFerias();
    }
    setSaving(false);
  };

  const handleCancelar = async () => {
    if (!cancelFerias) return;
    setSaving(true);
    const obsCancel = cancelMotivo.trim()
      ? `CANCELADA: ${cancelMotivo.trim()}${cancelFerias.observacao ? ` | ${cancelFerias.observacao}` : ''}`
      : cancelFerias.observacao;
    const { error } = await supabase.from('ferias' as any).update({
      status: 'cancelada', observacao: obsCancel,
    } as any).eq('id', cancelFerias.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const dias = calcDias(cancelFerias.data_inicio, cancelFerias.data_fim);
      toast({ title: `Férias canceladas. ${dias} dias devolvidos ao seu saldo.` });
      setCancelFerias(null);
      setCancelMotivo('');
      fetchFerias();
    }
    setSaving(false);
  };

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
      case 'cancelada': return 'bg-muted text-muted-foreground line-through';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  const statusLabel: Record<string, string> = {
    agendada: '📅 Agendada', ativa: '🟢 Ativa', concluida: '✅ Concluída', cancelada: '❌ Cancelada',
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
        <Input type="date" value={dataAdmissao} onChange={(e) => saveAdmissao(e.target.value)} className="rounded-xl" />
        <p className="text-[10px] text-muted-foreground mt-1">Necessária para calcular período aquisitivo e vencimento.</p>
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
                <span className="text-[10px] text-muted-foreground">Vencem em {diasAteVencer} dias</span>
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
          {inicio && fim && (() => {
            const v = validarPeriodo(inicio, fim);
            return (
              <>
                {v.erros.map((e, i) => (
                  <p key={i} className="text-[11px] text-destructive flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{e}</p>
                ))}
                {v.avisos.map((a, i) => (
                  <p key={i} className="text-[11px] text-warning flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</p>
                ))}
              </>
            );
          })()}
          <div className="flex gap-2">
            <Button onClick={handleAgendar} disabled={saving} className="flex-1 rounded-xl bg-accent text-accent-foreground text-sm">
              {saving ? 'Salvando...' : '🏖 Agendar férias'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl text-sm">Cancelar</Button>
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
          {ferias.map(f => {
            const dias = calcDias(f.data_inicio, f.data_fim);
            const isAtiva = f.status === 'ativa';
            const isAgendada = f.status === 'agendada';
            const isCancelada = f.status === 'cancelada';

            return (
              <div key={f.id} className={`bg-secondary rounded-xl p-3 space-y-2 ${isCancelada ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(f.status)}`}>
                    {statusLabel[f.status] || f.status}
                  </span>
                  {(isAgendada || isAtiva) && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(f)} className="h-7 w-7 p-0 text-muted-foreground">
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCancelFerias(f)} className="text-destructive h-7 w-7 p-0">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs">
                  {formatDate(f.data_inicio)} – {formatDate(f.data_fim)} · {dias} dias · {f.tipo === 'fracionada' ? 'Fracionadas' : 'Completas'}
                </p>
                {isAtiva && (
                  <div className="space-y-1">
                    <Progress value={calcProgresso(f.data_inicio, f.data_fim)} className="h-2" />
                    <p className="text-[10px] text-muted-foreground">
                      Dia {diasPassados(f.data_inicio)} de {dias}
                    </p>
                  </div>
                )}
                {isAgendada && (
                  <p className="text-[10px] text-muted-foreground">
                    Começa em {diasAte(f.data_inicio)} dias
                  </p>
                )}
                {f.observacao && <p className="text-[10px] text-muted-foreground">{f.observacao}</p>}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        ⚠️ Estimativa baseada em dados informados pelo usuário. Não substitui controle oficial da empresa.
      </p>

      {/* Edit Modal */}
      <Sheet open={!!editFerias} onOpenChange={o => !o && setEditFerias(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>✏️ Editar férias</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                <Input type="date" value={editInicio} onChange={e => setEditInicio(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                <Input type="date" value={editFim} onChange={e => setEditFim(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            {editInicio && editFim && calcDias(editInicio, editFim) > 0 && (
              <p className="text-xs text-muted-foreground">→ {calcDias(editInicio, editFim)} dias de férias</p>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" value="normal" checked={editTipo === 'normal'} onChange={() => setEditTipo('normal')} className="accent-accent" />
                  Completas
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" value="fracionada" checked={editTipo === 'fracionada'} onChange={() => setEditTipo('fracionada')} className="accent-accent" />
                  Fracionadas
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
              <Input value={editObs} onChange={e => setEditObs(e.target.value)} className="rounded-xl" />
            </div>
            {editInicio && editFim && editFerias && (() => {
              const v = validarPeriodo(editInicio, editFim, editFerias.id);
              return (
                <>
                  {v.erros.map((e, i) => (
                    <p key={i} className="text-[11px] text-destructive flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{e}</p>
                  ))}
                  {v.avisos.map((a, i) => (
                    <p key={i} className="text-[11px] text-warning flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</p>
                  ))}
                </>
              );
            })()}
            {editFerias?.status === 'ativa' && (
              <p className="text-[11px] text-warning flex items-start gap-1">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Editar férias ativas pode afetar os registros já no histórico.
              </p>
            )}
            <div className="flex gap-2 pb-4">
              <Button onClick={handleSaveEdit} disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'Salvando...' : '💾 Salvar alterações'}
              </Button>
              <Button variant="outline" onClick={() => setEditFerias(null)} className="rounded-xl">Cancelar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Modal */}
      <Sheet open={!!cancelFerias} onOpenChange={o => !o && setCancelFerias(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Cancelar período de férias?</SheetTitle>
          </SheetHeader>
          {cancelFerias && (
            <div className="space-y-3 mt-4">
              <p className="text-sm">
                {formatDate(cancelFerias.data_inicio)} – {formatDate(cancelFerias.data_fim)} ({calcDias(cancelFerias.data_inicio, cancelFerias.data_fim)} dias)
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Motivo do cancelamento (opcional)</label>
                <Textarea
                  value={cancelMotivo}
                  onChange={e => setCancelMotivo(e.target.value)}
                  placeholder="Ex: mudança de planos"
                  className="rounded-xl text-xs min-h-[60px]"
                />
              </div>
              <p className="text-[11px] text-warning flex items-start gap-1">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Os dias de férias serão removidos do histórico automaticamente.
              </p>
              <div className="flex gap-2 pb-4">
                <Button onClick={handleCancelar} disabled={saving} variant="destructive" className="flex-1 rounded-xl">
                  {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
                </Button>
                <Button variant="outline" onClick={() => setCancelFerias(null)} className="rounded-xl">Voltar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default FeriasConfig;
