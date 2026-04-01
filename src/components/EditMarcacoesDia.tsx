import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, Upload, ExternalLink, Trash2, Loader2, FileText, Plus } from 'lucide-react';
import {
  buscarMarcacoesDia, calcularJornada, formatarHoraLocal,
  formatarDuracaoJornada, getMarcacaoVisual, inserirMarcacaoManual,
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

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

const EditMarcacoesDia: React.FC<EditMarcacoesDiaProps> = ({ open, onClose, data, onSaved }) => {
  const { user, profile } = useAuth();
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [novoTipo, setNovoTipo] = useState<TipoMarcacao>('entrada');
  const [novoHorario, setNovoHorario] = useState('');

  // Atestado state
  const [atestadoUrl, setAtestadoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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
      // Check for existing atestado in registros_ponto
      loadAtestado();
    }
  }, [open, data]);

  const loadAtestado = async () => {
    if (!user || !data) return;
    const { data: regs } = await supabase
      .from('registros_ponto')
      .select('anexo_url, manha_atestado_url, tarde_atestado_url')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (regs && regs.length > 0) {
      setAtestadoUrl(regs[0].anexo_url || regs[0].manha_atestado_url || regs[0].tarde_atestado_url || null);
    } else {
      setAtestadoUrl(null);
    }
  };

  const jornada = calcularJornada(marcacoes);

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

  const handleDeleteMarcacao = async (id: string) => {
    setLoading(true);
    await supabase.from('marcacoes_ponto').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    toast({ title: 'Marcação removida' });
    await fetchMarcacoes();
    onSaved();
    setLoading(false);
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
    // Save to registros_ponto for the day (upsert)
    const { data: existing } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('user_id', user.id)
      .eq('data', data)
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('registros_ponto').update({ anexo_url: path } as any).eq('id', existing[0].id);
    }
    setUploading(false);
    toast({ title: '🏥 Atestado anexado!' });
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
        await supabase.from('registros_ponto').update({ anexo_url: null } as any).eq('id', existing[0].id);
      }
    }
    setAtestadoUrl(null);
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registro do dia</SheetTitle>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Summary */}
          {marcacoes.length > 0 && (
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Resumo</p>
              <p className="text-sm font-semibold">
                {formatarDuracaoJornada(jornada.totalTrabalhado)} trabalhadas
                {jornada.totalIntervalo > 0 && ` · ${formatarDuracaoJornada(jornada.totalIntervalo)} intervalo`}
              </p>
              {jornada.primeiraEntrada && jornada.ultimaSaida && (
                <p className="text-xs text-muted-foreground">
                  {formatarHoraLocal(jornada.primeiraEntrada)} → {formatarHoraLocal(jornada.ultimaSaida)}
                </p>
              )}
            </div>
          )}

          {/* Marcações list */}
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-2">MARCAÇÕES</p>
            {marcacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma marcação neste dia</p>
            ) : (
              <div className="space-y-2">
                {marcacoes.map((m) => {
                  const visual = getMarcacaoVisual(m.tipo);
                  return (
                    <div key={m.id} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                      <span>{visual.icone}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{visual.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatarHoraLocal(m.horario)}
                          {m.origem === 'manual' && ' · ✏️ manual'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 w-7 p-0"
                        onClick={() => handleDeleteMarcacao(m.id)}
                        disabled={loading}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new marcação */}
          {!addingNew ? (
            <Button
              variant="outline"
              className="w-full rounded-xl gap-2 text-xs"
              onClick={() => {
                setAddingNew(true);
                // Suggest next tipo based on existing
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

          {/* Atestado section */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">📋 Atestado médico / documento</p>

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
                  📎 Anexar arquivo
                </Button>
              </div>
            ) : (
              <div className="border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-xs text-foreground flex-1">Atestado anexado</span>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive h-7" onClick={handleRemoveAtestado}>
                    <Trash2 size={12} /> Remover
                  </Button>
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

          <div className="pb-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditMarcacoesDia;
