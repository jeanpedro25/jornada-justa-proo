import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, Upload, ExternalLink, Trash2, Loader2, FileText } from 'lucide-react';

type PeriodoEstado = 'pendente' | 'registrado' | 'atestado';

interface BlocoConfig {
  id: string;       // 'manha' | 'tarde' | 'turno_a' | 'turno_b' | 'turno_c'
  label: string;
  icone: string;
  horarioRef?: string;
  dbEntrada: 'manha_entrada' | 'tarde_entrada';
  dbSaida: 'manha_saida' | 'tarde_saida';
  dbEstado: 'manha_estado' | 'tarde_estado';
  dbAtestadoUrl: 'manha_atestado_url' | 'tarde_atestado_url';
}

interface BlocoState {
  estado: PeriodoEstado;
  entrada: string;
  saida: string;
}

interface EditRegistroDiaProps {
  open: boolean;
  onClose: () => void;
  registro: {
    id: string;
    data: string;
    manha_entrada: string | null;
    manha_saida: string | null;
    manha_estado: string | null;
    manha_atestado_url: string | null;
    tarde_entrada: string | null;
    tarde_saida: string | null;
    tarde_estado: string | null;
    tarde_atestado_url: string | null;
    intervalo_minutos: number | null;
    observacao: string | null;
  } | null;
  onSaved: () => void;
}

const INTERVALO_OPTIONS = [
  { label: 'Nenhum', value: 0 },
  { label: '15min', value: 15 },
  { label: '30min', value: 30 },
  { label: '1h', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
];

const estadoBadge = (estado: PeriodoEstado) => {
  switch (estado) {
    case 'registrado':
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/20 text-success">✅ Registrado</span>;
    case 'atestado':
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">🏥 Atestado</span>;
    default:
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/20 text-warning">⚠️ Pendente</span>;
  }
};

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

const formatTimeRef = (t: string | null) => {
  if (!t) return '--:--';
  return t.substring(0, 5);
};

const EditRegistroDia: React.FC<EditRegistroDiaProps> = ({ open, onClose, registro, onSaved }) => {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Atestado state (unified)
  const [atestadoUrl, setAtestadoUrl] = useState<string | null>(null);
  const [atestadoPeriodo, setAtestadoPeriodo] = useState<string | null>(null); // bloco id or 'integral'

  // Bloco states: keyed by bloco index 0 or 1
  const [blocoStates, setBlocoStates] = useState<BlocoState[]>([
    { estado: 'pendente', entrada: '', saida: '' },
    { estado: 'pendente', entrada: '', saida: '' },
  ]);
  const [intervaloMinutos, setIntervaloMinutos] = useState(60);
  const [observacao, setObservacao] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Build dynamic blocks based on profile
  const blocos: BlocoConfig[] = React.useMemo(() => {
    const p = profile as any;
    if (p?.tipo_jornada === 'turno') {
      const result: BlocoConfig[] = [];
      const turnos = [
        { key: 'a', icone: '🌅', dbIdx: 0 },
        { key: 'b', icone: '🌇', dbIdx: 1 },
      ];
      // Only support 2 turnos mapped to manha/tarde DB columns
      for (const t of turnos) {
        const inicio = p[`turno_${t.key}_inicio`];
        const fim = p[`turno_${t.key}_fim`];
        if (inicio && fim) {
          result.push({
            id: `turno_${t.key}`,
            label: `Turno ${t.key.toUpperCase()}`,
            icone: t.icone,
            horarioRef: `${formatTimeRef(inicio)} – ${formatTimeRef(fim)}`,
            dbEntrada: t.dbIdx === 0 ? 'manha_entrada' : 'tarde_entrada',
            dbSaida: t.dbIdx === 0 ? 'manha_saida' : 'tarde_saida',
            dbEstado: t.dbIdx === 0 ? 'manha_estado' : 'tarde_estado',
            dbAtestadoUrl: t.dbIdx === 0 ? 'manha_atestado_url' : 'tarde_atestado_url',
          });
        }
      }
      // If turno C exists, we can't store it without new columns — skip for now
      if (result.length === 0) {
        // Fallback to default
        return defaultBlocos();
      }
      return result;
    }
    return defaultBlocos();
  }, [profile]);

  function defaultBlocos(): BlocoConfig[] {
    return [
      { id: 'manha', label: 'Período manhã', icone: '🌅', dbEntrada: 'manha_entrada', dbSaida: 'manha_saida', dbEstado: 'manha_estado', dbAtestadoUrl: 'manha_atestado_url' },
      { id: 'tarde', label: 'Período tarde', icone: '🌇', dbEntrada: 'tarde_entrada', dbSaida: 'tarde_saida', dbEstado: 'tarde_estado', dbAtestadoUrl: 'tarde_atestado_url' },
    ];
  }

  // Init form from registro
  useEffect(() => {
    if (!registro) return;
    const states: BlocoState[] = blocos.map((bloco) => {
      const entrada = (registro as any)[bloco.dbEntrada] || '';
      const saida = (registro as any)[bloco.dbSaida] || '';
      const estado = ((registro as any)[bloco.dbEstado] || 'pendente') as PeriodoEstado;
      if (estado === 'atestado') return { estado: 'atestado', entrada: '', saida: '' };
      const hasData = !!entrada || !!saida;
      return { estado: hasData ? 'registrado' : 'pendente', entrada: entrada ? String(entrada).substring(0, 5) : '', saida: saida ? String(saida).substring(0, 5) : '' };
    });
    setBlocoStates(states);
    setIntervaloMinutos(registro.intervalo_minutos ?? 60);
    setObservacao(registro.observacao || '');

    // Reconstruct atestado
    const aPeriodo = (registro as any).atestado_periodo;
    if (aPeriodo) {
      setAtestadoPeriodo(aPeriodo);
      // Find the URL from the relevant bloco
      const url = (registro as any).manha_atestado_url || (registro as any).tarde_atestado_url || (registro as any).anexo_url;
      setAtestadoUrl(url || null);
    } else {
      // Check individual bloco atestado URLs
      const manhaAtestado = (registro as any).manha_estado === 'atestado';
      const tardeAtestado = (registro as any).tarde_estado === 'atestado';
      if (manhaAtestado && tardeAtestado) {
        setAtestadoPeriodo('integral');
        setAtestadoUrl((registro as any).manha_atestado_url || (registro as any).tarde_atestado_url || null);
      } else if (manhaAtestado) {
        setAtestadoPeriodo(blocos[0]?.id || 'manha');
        setAtestadoUrl((registro as any).manha_atestado_url || null);
      } else if (tardeAtestado) {
        setAtestadoPeriodo(blocos[1]?.id || 'tarde');
        setAtestadoUrl((registro as any).tarde_atestado_url || null);
      } else {
        setAtestadoPeriodo(null);
        setAtestadoUrl(null);
      }
    }
  }, [registro?.id, blocos.length]);

  const updateBloco = (idx: number, field: 'entrada' | 'saida', value: string) => {
    setBlocoStates(prev => {
      const next = [...prev];
      const b = { ...next[idx], [field]: value };
      b.estado = (b.entrada || b.saida) ? 'registrado' : 'pendente';
      next[idx] = b;
      return next;
    });
  };

  // Apply atestado period to bloco states
  useEffect(() => {
    if (!atestadoPeriodo || !atestadoUrl) return;
    setBlocoStates(prev => {
      return prev.map((bs, idx) => {
        const blocoId = blocos[idx]?.id;
        if (atestadoPeriodo === 'integral' || atestadoPeriodo === blocoId) {
          return { estado: 'atestado' as PeriodoEstado, entrada: '', saida: '' };
        }
        // If this bloco was atestado but no longer covered, reset to pendente
        if (bs.estado === 'atestado') {
          return { estado: 'pendente' as PeriodoEstado, entrada: '', saida: '' };
        }
        return bs;
      });
    });
  }, [atestadoPeriodo, atestadoUrl]);

  const handleUpload = async (file: File) => {
    if (!user || !registro) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${registro.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('atestados').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    setAtestadoUrl(path);
    setAtestadoPeriodo('integral'); // default to full day
    setUploading(false);
    toast({ title: '🏥 Atestado anexado!' });
  };

  const handleRemoveAtestado = async () => {
    if (atestadoUrl) await supabase.storage.from('atestados').remove([atestadoUrl]);
    setAtestadoUrl(null);
    setAtestadoPeriodo(null);
    // Reset all atestado blocos back to pendente
    setBlocoStates(prev => prev.map(bs => bs.estado === 'atestado' ? { estado: 'pendente' as PeriodoEstado, entrada: '', saida: '' } : bs));
  };

  const handleSave = async () => {
    if (!registro || !user) return;
    setSaving(true);

    const updateData: Record<string, any> = {
      intervalo_minutos: intervaloMinutos,
      observacao: observacao || null,
      editado_manualmente: true,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    };

    // Write each bloco to its DB columns
    blocos.forEach((bloco, idx) => {
      const bs = blocoStates[idx];
      if (!bs) return;
      updateData[bloco.dbEstado] = bs.estado;
      updateData[bloco.dbEntrada] = bs.estado === 'registrado' && bs.entrada ? bs.entrada : null;
      updateData[bloco.dbSaida] = bs.estado === 'registrado' && bs.saida ? bs.saida : null;
      updateData[bloco.dbAtestadoUrl] = bs.estado === 'atestado' ? atestadoUrl : null;
    });

    // Legacy atestado_periodo
    const atestadoBlocos = blocoStates.filter(bs => bs.estado === 'atestado');
    if (atestadoBlocos.length === blocos.length && atestadoBlocos.length > 0) {
      updateData.atestado_periodo = 'integral';
    } else if (atestadoBlocos.length > 0) {
      const idx = blocoStates.findIndex(bs => bs.estado === 'atestado');
      updateData.atestado_periodo = blocos[idx]?.id || null;
    } else {
      updateData.atestado_periodo = null;
    }

    const { error } = await supabase.from('registros_ponto').update(updateData as any).eq('id', registro.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro atualizado!' });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!registro) return;
    setSaving(true);
    await supabase.from('registros_ponto').update({ deleted_at: new Date().toISOString() } as any).eq('id', registro.id);
    toast({ title: 'Registro removido' });
    onSaved();
    onClose();
    setSaving(false);
  };

  const hasAnyRegistrado = blocoStates.some(bs => bs.estado === 'registrado');

  const dateObj = registro ? new Date(registro.data + 'T12:00:00') : new Date();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dateLabel = `${dias[dateObj.getDay()]}, ${dateObj.getDate()} de ${meses[dateObj.getMonth()]}`;

  const renderBloco = (bloco: BlocoConfig, idx: number) => {
    const bs = blocoStates[idx];
    if (!bs) return null;

    if (bs.estado === 'atestado') {
      return (
        <div key={bloco.id} className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{bloco.icone} {bloco.label}</p>
              {bloco.horarioRef && <p className="text-[10px] text-muted-foreground">ref: {bloco.horarioRef}</p>}
            </div>
            {estadoBadge('atestado')}
          </div>
          <div className="bg-blue-100/60 dark:bg-blue-900/30 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Coberto por atestado médico</p>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1">Entrada e saída não necessários</p>
          </div>
          {atestadoUrl && (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
              const { data } = await supabase.storage.from('atestados').createSignedUrl(atestadoUrl, 3600);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
            }}>
              <ExternalLink size={12} /> Ver documento
            </Button>
          )}
        </div>
      );
    }

    return (
      <div key={bloco.id} className={`border rounded-xl p-4 space-y-3 ${bs.estado === 'registrado' ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{bloco.icone} {bloco.label}</p>
            {bloco.horarioRef && <p className="text-[10px] text-muted-foreground">ref: {bloco.horarioRef}</p>}
          </div>
          {estadoBadge(bs.estado)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entrada</label>
            <Input type="time" value={bs.entrada} onChange={e => updateBloco(idx, 'entrada', e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Saída</label>
            <Input type="time" value={bs.saida} onChange={e => updateBloco(idx, 'saida', e.target.value)} className="rounded-xl" />
          </div>
        </div>
      </div>
    );
  };

  // Atestado period options: each bloco + integral
  const atestadoOptions = [
    ...blocos.map(b => ({ value: b.id, label: b.label, detail: b.horarioRef })),
    { value: 'integral', label: 'Dia inteiro', detail: undefined },
  ];

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registro do dia</SheetTitle>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Dynamic blocks */}
          {blocos.map((bloco, idx) => renderBloco(bloco, idx))}

          {/* Intervalo - only if at least one period is registered */}
          {hasAnyRegistrado && blocos.length > 1 && (
            <>
              <div className="flex items-center gap-2 px-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">🍽 Intervalo</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="flex gap-1.5 flex-wrap px-1">
                {INTERVALO_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setIntervaloMinutos(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${intervaloMinutos === opt.value ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Unified Atestado Section */}
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
              <div className="border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-xs text-foreground flex-1">Atestado anexado</span>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive h-7" onClick={handleRemoveAtestado}>
                    <Trash2 size={12} /> Remover
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
                    const { data } = await supabase.storage.from('atestados').createSignedUrl(atestadoUrl, 3600);
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                  }}>
                    <ExternalLink size={12} /> Ver documento
                  </Button>
                </div>

                {/* Period selector */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Qual período o atestado cobre?</p>
                  <div className="space-y-1.5">
                    {atestadoOptions.map(opt => (
                      <button key={opt.value} onClick={() => setAtestadoPeriodo(opt.value)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${atestadoPeriodo === opt.value ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 ring-1 ring-blue-300' : 'bg-secondary text-secondary-foreground'}`}>
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${atestadoPeriodo === opt.value ? 'border-blue-600' : 'border-muted-foreground/40'}`}>
                          {atestadoPeriodo === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                        </span>
                        <span>{opt.label}</span>
                        {opt.detail && <span className="text-muted-foreground ml-auto">({opt.detail})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="text-sm font-medium mb-1 block">Observação</label>
            <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" className="rounded-xl" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 pb-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-primary text-primary-foreground">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button onClick={handleDelete} disabled={saving} variant="destructive" className="rounded-xl">
              Excluir dia
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditRegistroDia;
