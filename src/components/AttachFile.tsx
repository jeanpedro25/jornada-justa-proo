import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Upload, Loader2, Camera, ExternalLink, Trash2 } from 'lucide-react';

export type AtestadoPeriodo = 'manha' | 'tarde' | 'integral';

interface AttachFileProps {
  registroIds: string[];
  currentUrl?: string | null;
  currentPeriodo?: AtestadoPeriodo | null;
  onAttached: (periodo: AtestadoPeriodo) => void;
  onRemoved?: () => void;
}

const PERIODO_LABELS: Record<AtestadoPeriodo, string> = {
  manha: '☀️ Manhã',
  tarde: '🌅 Tarde',
  integral: '📋 Integral (dia todo)',
};

const AttachFile: React.FC<AttachFileProps> = ({ registroIds, currentUrl, currentPeriodo, onAttached, onRemoved }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [periodo, setPeriodo] = useState<AtestadoPeriodo>(currentPeriodo || 'integral');
  const [showSelector, setShowSelector] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowSelector(true);
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile || !user || registroIds.length === 0) return;
    setUploading(true);

    const ext = pendingFile.name.split('.').pop();
    const path = `${user.id}/${registroIds[0]}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('atestados')
      .upload(path, pendingFile, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    for (const id of registroIds) {
      await supabase.from('registros_ponto').update({
        anexo_url: path,
        atestado_periodo: periodo,
      } as any).eq('id', id);
    }

    toast({
      title: '🏥 Atestado anexado!',
      description: `Período: ${PERIODO_LABELS[periodo]}`,
    });
    setPendingFile(null);
    setShowSelector(false);
    onAttached(periodo);
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!user || registroIds.length === 0) return;
    setUploading(true);

    if (currentUrl) {
      await supabase.storage.from('atestados').remove([currentUrl]);
    }

    for (const id of registroIds) {
      await supabase.from('registros_ponto').update({
        anexo_url: null,
        atestado_periodo: null,
      } as any).eq('id', id);
    }

    toast({ title: 'Atestado removido' });
    setUploading(false);
    onRemoved?.();
  };

  // If atestado already exists, show status card
  if (currentUrl && currentPeriodo) {
    return (
      <div className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          🏥 Atestado médico anexado
        </p>
        <p className="text-xs text-muted-foreground">
          Período coberto: <strong>{PERIODO_LABELS[currentPeriodo]}</strong>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={async () => {
              const { data } = await supabase.storage.from('atestados').createSignedUrl(currentUrl, 3600);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
            }}
          >
            <ExternalLink size={12} /> Ver atestado
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs text-destructive"
            disabled={uploading}
            onClick={handleRemove}
          >
            <Trash2 size={12} /> Remover
          </Button>
        </div>
      </div>
    );
  }

  // Pending file — show period selector
  if (showSelector && pendingFile) {
    return (
      <div className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">📋 Atestado selecionado</p>
        <p className="text-xs text-muted-foreground">{pendingFile.name}</p>

        <div>
          <label className="text-sm font-medium mb-2 block">Qual período o atestado cobre?</label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as AtestadoPeriodo)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manha">
                <div>
                  <span>☀️ Período manhã</span>
                  <p className="text-[10px] text-muted-foreground">Entrada manhã dispensada</p>
                </div>
              </SelectItem>
              <SelectItem value="tarde">
                <div>
                  <span>🌅 Período tarde</span>
                  <p className="text-[10px] text-muted-foreground">Entrada tarde dispensada</p>
                </div>
              </SelectItem>
              <SelectItem value="integral">
                <div>
                  <span>📋 Dia inteiro</span>
                  <p className="text-[10px] text-muted-foreground">Dia todo dispensado</p>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirmUpload} disabled={uploading} className="flex-1 rounded-xl" size="sm">
            {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {uploading ? 'Enviando...' : 'Confirmar'}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => { setPendingFile(null); setShowSelector(false); }}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Default — upload buttons
  return (
    <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium flex items-center gap-1">
        <Paperclip size={14} />
        Anexar atestado / documento
      </p>
      <p className="text-[10px] text-muted-foreground italic">
        Foto do atestado, PDF ou documento. Serve como prova nos seus registros.
      </p>

      <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileSelected} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelected} className="hidden" />

      <div className="grid grid-cols-2 gap-3">
        {isMobile && (
          <Button variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()} className="gap-2 h-14 flex-col">
            <Camera size={18} />
            <span className="text-xs">📷 Tirar foto</span>
          </Button>
        )}
        <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className={`gap-2 h-14 flex-col ${!isMobile ? 'col-span-2' : ''}`}>
          <Upload size={18} />
          <span className="text-xs">{isMobile ? 'Escolher arquivo' : '📎 Anexar atestado'}</span>
        </Button>
      </div>
    </div>
  );
};

export default AttachFile;
