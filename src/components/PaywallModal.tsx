import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, TrendingUp, FileText, Clock, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { iniciarCheckoutMercadoPago } from '@/lib/payments';
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
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'mensal' | 'anual'>('anual');
  const [processing, setProcessing] = useState(false);

  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  const handleSubscribe = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      const plano = selectedPlan === 'mensal' ? 'pro' : 'anual';
      const res = await iniciarCheckoutMercadoPago(supabase, plano, user, profile);
      if (res.error) throw new Error(res.error);
      const url = res.init_point || res.sandbox_init_point;
      if (!url) throw new Error('URL de pagamento não retornada.');
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao iniciar pagamento', description: msg, variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto p-0 overflow-hidden rounded-2xl border-0 bg-card
        sm:top-[50%] sm:translate-y-[-50%]
        top-auto bottom-0 left-0 right-0 translate-x-0 translate-y-0 w-full sm:w-auto
        sm:rounded-2xl rounded-t-2xl rounded-b-none
        max-h-[92vh] overflow-y-auto
        sm:left-[50%] sm:right-auto sm:translate-x-[-50%]">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 pb-8 text-center relative">
          {/* Botão X visível sobre o fundo escuro */}
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <Lock size={28} className="mx-auto mb-3 opacity-80" />
          <h2 className="text-xl font-bold mb-1">Visualize a estimativa completa da sua jornada</h2>
          <p className="text-sm opacity-80">
            Desbloqueie sua estimativa financeira e organize seu extrato pessoal por apenas R$ 9,90/mês ou R$ 89,90/ano
          </p>
        </div>


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
              <p className="text-xl font-bold">R$ 89,90</p>
              <p className="text-[10px] text-muted-foreground">/ano</p>
              <p className="text-[10px] text-accent font-semibold mt-1">Melhor custo anual</p>
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

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            ⚠️ Os valores exibidos são <strong>estimativas</strong> calculadas com base nos dados informados por você (salário, percentual de hora extra, horários). O valor real pode variar. O Hora Justa é uma ferramenta de organização pessoal e <strong>não substitui</strong> holerites, registros oficiais ou orientação jurídica.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaywallModal;
