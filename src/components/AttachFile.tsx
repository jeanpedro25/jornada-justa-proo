import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Paperclip, Upload, Loader2 } from 'lucide-react';

interface AttachFileProps {
  registroId: string;
  currentUrl?: string | null;
  onAttached: () => void;
}

const AttachFile: React.FC<AttachFileProps> = ({ registroId, currentUrl, onAttached }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${registroId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('atestados')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    // Store the path (not public URL) since bucket is private
    const { error: updateError } = await supabase
      .from('registros_ponto')
      .update({ anexo_url: path } as any)
      .eq('id', registroId);

    if (updateError) {
      toast({ title: 'Erro', description: updateError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atestado anexado!', description: 'Arquivo salvo como prova.' });
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
            Envie foto do atestado, declaração ou qualquer documento que comprove sua situação.
          </p>
          {currentUrl && (
            <button
              onClick={async () => {
                const { data } = await supabase.storage.from('atestados').createSignedUrl(currentUrl, 3600);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}
              className="text-sm text-accent underline block text-left">
              📎 Ver documento atual
            </button>
          )}
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Enviando...' : 'Escolher arquivo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachFile;
