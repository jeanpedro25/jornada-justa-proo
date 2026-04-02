import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, ExternalLink, Trash2, Loader2, FileText, Plus, Pencil, AlertTriangle } from 'lucide-react';
import {
  buscarMarcacoesDia, calcularJornada, calcularHoraExtra, formatarHoraLocal,
  formatarDuracaoJornada, getMarcacaoVisual, inserirMarcacaoManual, getCargaDiaria,
  type Marcacao, type TipoMarcacao,
} from '@/lib/jornada';

interface EditMarcacoesDiaProps {
  open: boolean;
  onClose: () => void;
  data: string | null;
  onSaved: () => void;
}

const TIPO_OPTIONS: { value: TipoMarcacao; label: string }[] = [
  { value: 'entrada', label: '🟢 Entrada' },
  { value: 'saida_intervalo', label: '🟡 Saída intervalo' },
  { value: 'volta_intervalo', label: '🔵 Volta intervalo' },
  { value: 'saida_final', label: '🔴 Saída final' },
];

const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);

const EditMarcacoesDia: React.FC<EditMarcacoesDiaProps> = ({ open, onClose, data, onSaved }) => {
  const { user, profile } = useAuth();
  const p = profile as any;
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoMarcacao>('entrada');
  const [novoHorario, setNovoHorario] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHorario, setEditHorario] = useState('');
  const [observacao, setObservacao] = useState('');

  // Atestado
  const [atestadoUrl, setAtestadoUrl] = useState<string | null>(null);
  const [atestadoPeriodo, setAtestadoPeriodo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );

  const fetchMarcacoes = async () => {
    if (!user || !data) return;
    const m = await buscarMarcacoesDia(user.id, data);
    setMarcacoes(m);
  };

  useEffect(() => {
    if (open && data) {
      fetchMarcacoes();
      setAddingNew(false);
      setNovoHorario('');
      setEditingId(null);
      loadAtestado();
      loadObservacao();
    }
  }, [open, data]);

  const loadAtestado = async () => {
    if (!user || !data) return;
    const { data: regs } = await supabase
      .from('registros_ponto')
      .select('anexo_url, manha_atestado_url, tarde_atestado_url, atestado_periodo')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (regs && regs.length > 0) {
      setAtestadoUrl(regs[0].anexo_url || regs[0].manha_atestado_url || regs[0].tarde_atestado_url || null);
      setAtestadoPeriodo(regs[0].atestado_periodo || null);
    } else {
      setAtestadoUrl(null);
      setAtestadoPeriodo(null);
    }
  };

  const loadObservacao = async () => {
    if (!user || !data) return;
    const { data: regs } = await supabase
      .from('registros_ponto')
      .select('observacao')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    setObservacao(regs?.[0]?.observacao || '');
  };

  const jornada = calcularJornada(marcacoes);
  const horaExtra = calcularHoraExtra(jornada.totalTrabalhado, carga);

  // Warnings
  const avisos = useMemo(() => {
    const list: { tipo: 'warning' | 'info'; msg: string }[] = [];
    if (jornada.totalTrabalhado > 600 && jornada.totalIntervalo < 60) {
      list.push({ tipo: 'warning', msg: 'Intervalo menor que 1h para jornada acima de 6h (Art. 71 CLT)' });
    }
    if (jornada.totalTrabalhado > 600) {
      list.push({ tipo: 'warning', msg: 'Jornada acima de 10h registrada' });
    }
    // Check sequence
    for (let i = 1; i < marcacoes.length; i++) {
      if (new Date(marcacoes[i].horario) < new Date(marcacoes[i - 1].horario)) {
        list.push({ tipo: 'warning', msg: 'Horários fora de ordem — verifique a sequência' });
        break;
      }
    }
    if (marcacoes.some(m => m.origem === 'manual')) {
      list.push({ tipo: 'info', msg: 'Registro editado manualmente será marcado com ✏️ no histórico' });
    }
    return list;
  }, [marcacoes, jornada]);

  const dateObj = data ? new Date(data + 'T12:00:00') : new Date();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dateLabel = `${dias[dateObj.getDay()]}, ${dateObj.getDate()} de ${meses[dateObj.getMonth()]}`;

  const handleAddMarcacao = async () => {
    if (!user || !data || !novoHorario) return;
    setLoading(true);
    try {
      const horarioTs = new Date(`${data}T${novoHorario}:00`).toISOString();
      await inserirMarcacaoManual(user.id, data, novoTipo, horarioTs);
      toast({ title: '✅ Marcação adicionada!' });
      await fetchMarcacoes();
      setAddingNew(false);
      setNovoHorario('');
      onSaved();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleEditMarcacao = async (id: string) => {
    if (!data || !editHorario) return;
    setLoading(true);
    const horarioTs = new Date(`${data}T${editHorario}:00`).toISOString();
    const { error } = await supabase
      .from('marcacoes_ponto')
      .update({ horario: horarioTs, origem: 'correcao' } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Horário atualizado!' });
      setEditingId(null);
      await fetchMarcacoes();
      onSaved();
    }
    setLoading(false);
  };

  const handleDeleteMarcacao = async (id: string) => {
    if (!confirm('Remover esta marcação?')) return;
    setLoading(true);
    await supabase.from('marcacoes_ponto').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    toast({ title: 'Marcação removida' });
    await fetchMarcacoes();
    onSaved();
    setLoading(false);
  };

  const handleDeleteDay = async () => {
    if (!user || !data) return;
    if (!confirm('Excluir TODAS as marcações deste dia? Essa ação não pode ser desfeita.')) return;
    setLoading(true);
    const now = new Date().toISOString();
    await supabase.from('marcacoes_ponto').update({ deleted_at: now } as any).eq('user_id', user.id).eq('data', data).is('deleted_at', null);
    toast({ title: 'Dia excluído' });
    onSaved();
    onClose();
    setLoading(false);
  };

  const handleSaveObservacao = async () => {
    if (!user || !data) return;
    const { data: existing } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('registros_ponto').update({ observacao: observacao.trim() || null } as any).eq('id', existing[0].id);
      toast({ title: 'Observação salva' });
    }
  };

  const handleUpload = async (file: File) => {
    if (!user || !data) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${data}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('atestados').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    setAtestadoUrl(path);
    const { data: existing } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('registros_ponto').update({ anexo_url: path } as any).eq('id', existing[0].id);
    } else {
      // Create a registros_ponto record to hold the atestado
      await supabase.from('registros_ponto').insert({
        user_id: user.id,
        data: data,
        entrada: new Date(`${data}T00:00:00`).toISOString(),
        anexo_url: path,
        editado_manualmente: true,
      } as any);
    }
    setUploading(false);
    toast({ title: '🏥 Atestado anexado!' });
  };

  const handleSetAtestadoPeriodo = async (periodo: string) => {
    if (!user || !data) return;
    setAtestadoPeriodo(periodo);
    const { data: existing } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('registros_ponto').update({ atestado_periodo: periodo } as any).eq('id', existing[0].id);
    }
  };

  const handleRemoveAtestado = async () => {
    if (atestadoUrl) {
      await supabase.storage.from('atestados').remove([atestadoUrl]);
    }
    if (user && data) {
      const { data: existing } = await supabase
        .from('registros_ponto')
        .select('id')
        .eq('user_id', user.id)
        .eq('data', data)
        .is('deleted_at', null)
        .limit(1);
      if (existing && existing.length > 0) {
        await supabase.from('registros_ponto').update({ anexo_url: null, atestado_periodo: null } as any).eq('id', existing[0].id);
      }
    }
    setAtestadoUrl(null);
    setAtestadoPeriodo(null);
  };

  const startEdit = (m: Marcacao) => {
    setEditingId(m.id);
    // Extract HH:MM from the ISO timestamp
    const d = new Date(m.horario);
    setEditHorario(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>✏️ Editar dia</SheetTitle>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Marcações */}
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-2">MARCAÇÕES DO DIA</p>
            {marcacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma marcação neste dia</p>
            ) : (
              <div className="space-y-2">
                {marcacoes.map((m) => {
                  const visual = getMarcacaoVisual(m.tipo);
                  const isEditing = editingId === m.id;
                  return (
                    <div key={m.id} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                      <span>{visual.icone}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{visual.label}</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="time"
                              value={editHorario}
                              onChange={e => setEditHorario(e.target.value)}
                              className="rounded-lg h-8 text-xs w-28"
                            />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleEditMarcacao(m.id)} disabled={loading}>
                              ✓
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {formatarHoraLocal(m.horario)}
                            {m.origem === 'manual' && ' · ✏️ manual'}
                            {m.origem === 'correcao' && ' · ✏️ editado'}
                          </p>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(m)}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-7 w-7 p-0"
                            onClick={() => handleDeleteMarcacao(m.id)}
                            disabled={loading}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new */}
          {!addingNew ? (
            <Button
              variant="outline"
              className="w-full rounded-xl gap-2 text-xs"
              onClick={() => {
                setAddingNew(true);
                if (marcacoes.length === 0) setNovoTipo('entrada');
                else {
                  const last = marcacoes[marcacoes.length - 1].tipo;
                  if (last === 'entrada') setNovoTipo('saida_intervalo');
                  else if (last === 'saida_intervalo') setNovoTipo('volta_intervalo');
                  else if (last === 'volta_intervalo') setNovoTipo('saida_final');
                  else setNovoTipo('entrada');
                }
              }}
            >
              <Plus size={14} /> Adicionar marcação
            </Button>
          ) : (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium">Nova marcação</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TIPO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNovoTipo(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        novoTipo === opt.value ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Horário</label>
                <Input type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddMarcacao} disabled={loading || !novoHorario} className="flex-1 rounded-xl">
                  {loading ? 'Salvando...' : 'Adicionar'}
                </Button>
                <Button variant="outline" onClick={() => setAddingNew(false)} className="rounded-xl">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Atestado */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">📋 Atestado médico</p>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} className="hidden" />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} className="hidden" />

            {!atestadoUrl ? (
              <div className="flex gap-2">
                {isMobile && (
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()} className="gap-1 text-xs">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    📷 Tirar foto
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-1 text-xs">
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  📎 Anexar
                </Button>
              </div>
            ) : (
              <div className="border border-border bg-secondary/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-accent" />
                  <span className="text-xs flex-1">Atestado anexado</span>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive h-7" onClick={handleRemoveAtestado}>
                    <Trash2 size={12} /> Remover
                  </Button>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Período do atestado</label>
                  <div className="flex gap-2">
                    {['manha', 'tarde', 'integral'].map(per => (
                      <button
                        key={per}
                        onClick={() => handleSetAtestadoPeriodo(per)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                          atestadoPeriodo === per ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {per === 'manha' ? 'Manhã' : per === 'tarde' ? 'Tarde' : 'Integral'}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
                  const { data } = await supabase.storage.from('atestados').createSignedUrl(atestadoUrl, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                }}>
                  <ExternalLink size={12} /> Ver documento
                </Button>
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">📝 Observação</p>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              onBlur={handleSaveObservacao}
              placeholder="Anotação sobre o dia (opcional)"
              className="rounded-xl text-xs min-h-[60px]"
            />
          </div>

          {/* Resumo calculado */}
          {marcacoes.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground font-semibold mb-2">RESUMO CALCULADO</p>
              <div className="bg-secondary/50 rounded-xl p-3 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Trabalhado:</span>{' '}
                  <span className="font-semibold">{formatarDuracaoJornada(jornada.totalTrabalhado)}</span>
                </p>
                {jornada.totalIntervalo > 0 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Intervalo:</span>{' '}
                    <span className="font-semibold">{formatarDuracaoJornada(jornada.totalIntervalo)}</span>
                  </p>
                )}
                {horaExtra > 0 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Hora extra:</span>{' '}
                    <span className="font-semibold text-warning">+{horaExtra.toFixed(1)}h</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Avisos */}
          {avisos.length > 0 && (
            <div className="space-y-1">
              {avisos.map((a, i) => (
                <p key={i} className={`text-[11px] flex items-start gap-1.5 ${a.tipo === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>
                  {a.tipo === 'warning' ? <AlertTriangle size={12} className="mt-0.5 shrink-0" /> : <span>ℹ️</span>}
                  {a.msg}
                </p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pb-4">
            <Button onClick={onClose} className="flex-1 rounded-xl">
              💾 Fechar
            </Button>
            {marcacoes.length > 0 && (
              <Button variant="outline" onClick={handleDeleteDay} disabled={loading} className="rounded-xl text-destructive border-destructive/30 gap-1 text-xs">
                <Trash2 size={13} /> Excluir dia
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditMarcacoesDia;
