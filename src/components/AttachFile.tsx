import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Upload, Loader2, Camera } from 'lucide-react';

interface AttachFileProps {
  registroId: string;
  currentUrl?: string | null;
  onAttached: () => void;
}

const AttachFile: React.FC<AttachFileProps> = ({ registroId, currentUrl, onAttached }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [periodo, setPeriodo] = useState<string>('integral');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${registroId}_${periodo}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('atestados')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('registros_ponto')
      .update({
        anexo_url: path,
        observacao: `atestado_${periodo}`,
      } as any)
      .eq('id', registroId);

    if (updateError) {
      toast({ title: 'Erro', description: updateError.message, variant: 'destructive' });
    } else {
      toast({
        title: '✅ Atestado anexado!',
        description: `Período: ${periodo === 'manha' ? 'Manhã' : periodo === 'tarde' ? 'Tarde' : 'Integral'}`,
      });
      onAttached();
      setOpen(false);
    }
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 rounded-lg text-xs">
          <Paperclip size={14} />
          {currentUrl ? 'Ver/trocar atestado' : 'Anexar atestado'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Anexar atestado ou documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie foto do atestado, declaração ou qualquer documento para seus registros.
          </p>
          <p className="text-[10px] text-muted-foreground/60 italic">
            O envio de documentos pode envolver dados sensíveis. O usuário consente com o armazenamento para uso dentro do aplicativo.
          </p>

          {currentUrl && (
            <button
              onClick={async () => {
                const { data } = await supabase.storage.from('atestados').createSignedUrl(currentUrl, 3600);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}
              className="text-sm text-accent underline block text-left"
            >
              📎 Ver documento atual
            </button>
          )}

          {/* Período do atestado */}
          <div>
            <label className="text-sm font-medium mb-1 block">Período do atestado</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">☀️ Manhã</SelectItem>
                <SelectItem value="tarde">🌅 Tarde</SelectItem>
                <SelectItem value="integral">📋 Integral (dia todo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File inputs */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleUpload}
            className="hidden"
          />
          {/* Camera input for mobile */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => cameraRef.current?.click()}
              className="gap-2 h-14 flex-col"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <span className="text-xs">{uploading ? 'Enviando...' : 'Tirar foto'}</span>
            </Button>
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-2 h-14 flex-col"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-xs">{uploading ? 'Enviando...' : 'Escolher arquivo'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachFile;
