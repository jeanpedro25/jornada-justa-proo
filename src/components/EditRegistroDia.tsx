import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, Upload, ExternalLink, Trash2, Loader2 } from 'lucide-react';

type PeriodoEstado = 'pendente' | 'registrado' | 'atestado';

interface Periodo {
  estado: PeriodoEstado;
  entrada: string;
  saida: string;
  atestadoUrl: string | null;
}

interface RegistroDia {
  manha: Periodo;
  tarde: Periodo;
  intervaloMinutos: number;
  observacao: string;
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

const EditRegistroDia: React.FC<EditRegistroDiaProps> = ({ open, onClose, registro, onSaved }) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingPeriodo, setUploadingPeriodo] = useState<'manha' | 'tarde' | null>(null);

  const fileRefManha = useRef<HTMLInputElement>(null);
  const cameraRefManha = useRef<HTMLInputElement>(null);
  const fileRefTarde = useRef<HTMLInputElement>(null);
  const cameraRefTarde = useRef<HTMLInputElement>(null);

  const buildInitial = (): RegistroDia => {
    if (!registro) return {
      manha: { estado: 'pendente', entrada: '', saida: '', atestadoUrl: null },
      tarde: { estado: 'pendente', entrada: '', saida: '', atestadoUrl: null },
      intervaloMinutos: 60,
      observacao: '',
    };

    const mkPeriodo = (entrada: string | null, saida: string | null, estado: string | null, url: string | null): Periodo => {
      const est = (estado || 'pendente') as PeriodoEstado;
      if (est === 'atestado') return { estado: 'atestado', entrada: '', saida: '', atestadoUrl: url };
      const hasData = !!entrada || !!saida;
      return {
        estado: hasData ? 'registrado' : 'pendente',
        entrada: entrada || '',
        saida: saida || '',
        atestadoUrl: null,
      };
    };

    return {
      manha: mkPeriodo(registro.manha_entrada, registro.manha_saida, registro.manha_estado, registro.manha_atestado_url),
      tarde: mkPeriodo(registro.tarde_entrada, registro.tarde_saida, registro.tarde_estado, registro.tarde_atestado_url),
      intervaloMinutos: registro.intervalo_minutos ?? 60,
      observacao: registro.observacao || '',
    };
  };

  const [form, setForm] = useState<RegistroDia>(buildInitial());

  // Reset form when registro changes
  React.useEffect(() => {
    setForm(buildInitial());
  }, [registro?.id]);

  const updatePeriodo = (periodo: 'manha' | 'tarde', field: 'entrada' | 'saida', value: string) => {
    setForm(prev => {
      const p = { ...prev[periodo], [field]: value };
      p.estado = (p.entrada || p.saida) ? 'registrado' : 'pendente';
      return { ...prev, [periodo]: p };
    });
  };

  const handleUpload = async (periodo: 'manha' | 'tarde', file: File) => {
    if (!user || !registro) return;
    setUploadingPeriodo(periodo);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${registro.id}-${periodo}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('atestados').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      setUploadingPeriodo(null);
      return;
    }

    setForm(prev => ({
      ...prev,
      [periodo]: { estado: 'atestado' as PeriodoEstado, entrada: '', saida: '', atestadoUrl: path },
    }));
    setUploadingPeriodo(null);
    toast({ title: '🏥 Atestado anexado!' });
  };

  const handleRemoveAtestado = async (periodo: 'manha' | 'tarde') => {
    const url = form[periodo].atestadoUrl;
    if (url) await supabase.storage.from('atestados').remove([url]);
    setForm(prev => ({
      ...prev,
      [periodo]: { estado: 'pendente' as PeriodoEstado, entrada: '', saida: '', atestadoUrl: null },
    }));
  };

  const handleSave = async () => {
    if (!registro || !user) return;
    setSaving(true);

    const updateData: Record<string, any> = {
      manha_entrada: form.manha.estado === 'registrado' && form.manha.entrada ? form.manha.entrada : null,
      manha_saida: form.manha.estado === 'registrado' && form.manha.saida ? form.manha.saida : null,
      manha_estado: form.manha.estado,
      manha_atestado_url: form.manha.atestadoUrl,
      tarde_entrada: form.tarde.estado === 'registrado' && form.tarde.entrada ? form.tarde.entrada : null,
      tarde_saida: form.tarde.estado === 'registrado' && form.tarde.saida ? form.tarde.saida : null,
      tarde_estado: form.tarde.estado,
      tarde_atestado_url: form.tarde.atestadoUrl,
      intervalo_minutos: form.intervaloMinutos,
      observacao: form.observacao || null,
      editado_manualmente: true,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    };

    // Also set legacy atestado_periodo for backward compat
    if (form.manha.estado === 'atestado' && form.tarde.estado === 'atestado') {
      updateData.atestado_periodo = 'integral';
    } else if (form.manha.estado === 'atestado') {
      updateData.atestado_periodo = 'manha';
    } else if (form.tarde.estado === 'atestado') {
      updateData.atestado_periodo = 'tarde';
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

  const hasAnyRegistrado = form.manha.estado === 'registrado' || form.tarde.estado === 'registrado';

  const dateObj = registro ? new Date(registro.data + 'T12:00:00') : new Date();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dateLabel = `${dias[dateObj.getDay()]}, ${dateObj.getDate()} de ${['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][dateObj.getMonth()]}`;

  const renderPeriodo = (periodo: 'manha' | 'tarde') => {
    const p = form[periodo];
    const label = periodo === 'manha' ? '🌅 Período manhã' : '🌇 Período tarde';
    const fileRef = periodo === 'manha' ? fileRefManha : fileRefTarde;
    const cameraRef = periodo === 'manha' ? cameraRefManha : cameraRefTarde;
    const isUploading = uploadingPeriodo === periodo;

    if (p.estado === 'atestado') {
      return (
        <div className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            {estadoBadge('atestado')}
          </div>
          <div className="bg-blue-100/60 dark:bg-blue-900/30 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Coberto por atestado médico</p>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-1">Entrada e saída não necessários</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
              if (p.atestadoUrl) {
                const { data } = await supabase.storage.from('atestados').createSignedUrl(p.atestadoUrl, 3600);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }
            }}>
              <ExternalLink size={12} /> Ver atestado
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive" onClick={() => handleRemoveAtestado(periodo)}>
              <Trash2 size={12} /> Remover
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={`border rounded-xl p-4 space-y-3 ${p.estado === 'registrado' ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{label}</p>
          {estadoBadge(p.estado)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entrada</label>
            <Input type="time" value={p.entrada} onChange={e => updatePeriodo(periodo, 'entrada', e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Saída</label>
            <Input type="time" value={p.saida} onChange={e => updatePeriodo(periodo, 'saida', e.target.value)} className="rounded-xl" />
          </div>
        </div>

        {/* Atestado upload */}
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(periodo, f); }} className="hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(periodo, f); }} className="hidden" />

        <div className="flex gap-2">
          {isMobile && (
            <Button variant="ghost" size="sm" disabled={isUploading} onClick={() => cameraRef.current?.click()} className="gap-1 text-xs">
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              📷 Foto atestado
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={isUploading} onClick={() => fileRef.current?.click()} className="gap-1 text-xs">
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            📎 Anexar atestado
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registro do dia</SheetTitle>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {renderPeriodo('manha')}

          {/* Intervalo - only if at least one period is registered */}
          {hasAnyRegistrado && (
            <div className="flex items-center gap-2 px-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">🍽 Intervalo</span>
              <div className="flex-1 border-t border-border" />
            </div>
          )}
          {hasAnyRegistrado && (
            <div className="flex gap-1.5 flex-wrap px-1">
              {INTERVALO_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setForm(prev => ({ ...prev, intervaloMinutos: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${form.intervaloMinutos === opt.value ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {renderPeriodo('tarde')}

          {/* Observação */}
          <div>
            <label className="text-sm font-medium mb-1 block">Observação</label>
            <Input value={form.observacao} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} placeholder="Opcional" className="rounded-xl" />
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
