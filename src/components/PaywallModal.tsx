import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, TrendingUp, FileText, Clock, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedValue?: number;
  trigger?: string;
}

const benefits = [
  { icon: TrendingUp, text: 'Estimativa completa de ganhos e descontos' },
  { icon: FileText, text: 'Extrato pessoal detalhado em PDF' },
  { icon: Clock, text: 'Histórico ilimitado' },
  { icon: Shield, text: 'Backup na nuvem' },
  { icon: Sparkles, text: 'Alertas inteligentes' },
  { icon: TrendingUp, text: 'Simulação de valor acumulado' },
];

const phrases = [
  'Organize sua jornada com mais clareza',
  'Tenha controle total das suas horas',
  'Sua jornada merece ser acompanhada de perto',
];

const PaywallModal: React.FC<PaywallModalProps> = ({ open, onOpenChange, estimatedValue, trigger }) => {
  const { user, refreshProfile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'mensal' | 'anual'>('anual');
  const [processing, setProcessing] = useState(false);

  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  const handleSubscribe = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      const plano = selectedPlan === 'anual' ? 'anual' : 'pro';
      await supabase.from('profiles').update({ plano }).eq('id', user.id);
      await refreshProfile();
      toast({ title: '🎉 Plano ativado!', description: 'Agora você tem acesso completo.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto p-0 overflow-hidden rounded-2xl border-0 bg-card">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 pb-8 text-center">
          <Lock size={28} className="mx-auto mb-3 opacity-80" />
          <h2 className="text-xl font-bold mb-1">Visualize a estimativa completa da sua jornada</h2>
          <p className="text-sm opacity-80">
            Desbloqueie sua estimativa financeira e organize seu extrato pessoal por apenas R$ 9,90/mês ou R$ 79,90/ano
          </p>
        </div>

        {/* Estimated value teaser */}
        {estimatedValue !== undefined && estimatedValue > 0 && (
          <div className="mx-6 -mt-4 bg-success/10 border border-success/30 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Você já acumulou aproximadamente</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(estimatedValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">em horas extras</p>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Estimativa baseada nos dados informados pelo usuário
            </p>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Emotional phrase */}
          <p className="text-center text-sm font-medium text-warning">{randomPhrase}</p>

          {/* Plans */}
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan('mensal')}
              className={`rounded-xl p-4 border-2 text-center transition-all ${
                selectedPlan === 'mensal'
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-secondary'
              }`}
            >
              <p className="text-xs text-muted-foreground mb-1">Mensal</p>
              <p className="text-xl font-bold">R$ 9,90</p>
              <p className="text-[10px] text-muted-foreground">/mês</p>
            </button>

            {/* Annual */}
            <button
              onClick={() => setSelectedPlan('anual')}
              className={`rounded-xl p-4 border-2 text-center transition-all relative ${
                selectedPlan === 'anual'
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-secondary'
              }`}
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-bold px-2 py-0.5 rounded-full">
                MELHOR VALOR
              </span>
              <p className="text-xs text-muted-foreground mb-1">Anual</p>
              <p className="text-xl font-bold">R$ 79,90</p>
              <p className="text-[10px] text-muted-foreground">/ano</p>
              <p className="text-[10px] text-accent font-semibold mt-1">Economize 33%</p>
            </button>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span className="text-foreground">{b.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            onClick={handleSubscribe}
            disabled={processing}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold text-base"
          >
            {processing ? 'Ativando...' : 'Desbloquear agora'}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Valores estimados. Estimativa baseada nos dados informados pelo usuário.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaywallModal;
