import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}

const DeleteAccountModal: React.FC<Props> = ({ open, onOpenChange, onConfirm, deleting }) => {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === 'EXCLUIR';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!deleting) { setConfirmText(''); onOpenChange(v); } }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="text-destructive" size={24} />
          </div>
          <DialogTitle className="text-destructive">Excluir conta</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            <strong>ATENÇÃO: Esta ação é irreversível.</strong><br />
            Todos os seus dados serão excluídos permanentemente, incluindo registros de ponto, histórico, configurações e alertas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="text-xs text-muted-foreground block">
            Digite <span className="font-bold text-destructive">EXCLUIR</span> para confirmar:
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="rounded-xl text-center font-semibold"
            disabled={deleting}
            autoComplete="off"
          />
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={onConfirm}
            disabled={!canDelete || deleting}
            variant="destructive"
            className="w-full rounded-xl"
          >
            {deleting ? 'Excluindo...' : 'Sim, excluir minha conta'}
          </Button>
          <Button
            onClick={() => { setConfirmText(''); onOpenChange(false); }}
            disabled={deleting}
            variant="outline"
            className="w-full rounded-xl"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountModal;
