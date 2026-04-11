import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlano } from '@/hooks/usePlano';
import { toast } from '@/hooks/use-toast';
import { iniciarCheckoutMercadoPago } from '@/lib/payments';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap, ArrowLeft, Crown, X } from 'lucide-react';

const PLANOS = [
  {
    id: 'pro',
    nome: 'PRO Mensal',
    preco: 9.90,
    precoPor: '/mês',
    economia: null,
    destaque: false,
    cor: 'from-accent/20 to-accent/5',
    corBorda: 'border-accent/30',
    icone: '⚡',
    recursos: [
      'Relatório PDF com marca d\'água',
      'Exportação Excel completa',
      'Banco de horas avançado',
      'Fechamento mensal',
      'Rescisão e cálculo trabalhista',
      'Suporte prioritário',
    ],
  },
  {
    id: 'anual',
    nome: 'PRO Anual',
    preco: 89.90,
    precoPor: '/ano',
    economia: '🎁 Economize R$28,90 vs mensal',
    destaque: true,
    cor: 'from-emerald-500/20 to-emerald-500/5',
    corBorda: 'border-emerald-500/40',
    icone: '👑',
    recursos: [
      'Tudo do plano mensal',
      '12 meses pelo preço de 9',
      'Acesso antecipado a novidades',
      'Relatórios históricos ilimitados',
      'Suporte VIP via WhatsApp',
    ],
  },
];

const PlanosPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { isPro, isTrial } = usePlano();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);

  // Detectar retorno do Mercado Pago
  useEffect(() => {
    const payment = searchParams.get('payment');
    const plano = searchParams.get('plano');
    if (payment === 'success' && plano) {
      toast({
        title: '🎉 Pagamento confirmado!',
        description: `Plano ${plano === 'anual' ? 'PRO Anual' : 'PRO Mensal'} ativado com sucesso! Aproveite todos os recursos premium.`,
      });
      refreshProfile();
      // Limpar query params
      navigate('/planos', { replace: true });
    } else if (payment === 'failure') {
      toast({ title: '❌ Pagamento não concluído', description: 'Tente novamente ou escolha outra forma de pagamento.', variant: 'destructive' });
      navigate('/planos', { replace: true });
    } else if (payment === 'pending') {
      toast({ title: '⏳ Pagamento pendente', description: 'Assim que confirmado, seu plano será ativado automaticamente.' });
      navigate('/planos', { replace: true });
    }
  }, [searchParams]);

  const handleAssinar = async (planoId: 'pro' | 'anual') => {
    if (!user || !profile) {
      navigate('/auth');
      return;
    }
    setLoading(planoId);
    try {
      const res = await iniciarCheckoutMercadoPago(supabase, planoId, user, profile);
      if (res.error) throw new Error(res.error);
      const url = res.init_point || res.sandbox_init_point;
      if (url) window.location.href = url;
      else throw new Error('URL de pagamento não retornada.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: '❌ Erro ao iniciar pagamento', description: msg, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  /** Trial ainda pode assinar; bloqueia só assinatura paga ativa (não reter quem já pagou). */
  const jaPro = isPro && !isTrial;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-base">Planos</h1>
          <p className="text-xs text-muted-foreground">Desbloqueie todos os recursos</p>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-6 max-w-lg mx-auto">

        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="text-4xl">🚀</div>
          <h2 className="text-xl font-black">Hora Justa PRO</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Relatórios completos, exportação Excel, banco de horas avançado e muito mais. Tudo para você ter controle total da sua jornada.
          </p>
        </div>

        {/* Plano atual */}
        {jaPro && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
            <Crown size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Você já é PRO! 🎉</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400">Todos os recursos estão desbloqueados para você.</p>
            </div>
          </div>
        )}

        {/* Cards de plano */}
        {PLANOS.map((plano) => (
          <div
            key={plano.id}
            className={`relative rounded-2xl border-2 bg-gradient-to-b ${plano.cor} ${plano.corBorda} overflow-hidden`}
          >
            {plano.destaque && (
              <div className="bg-emerald-500 text-white text-[10px] font-black text-center py-1.5 tracking-widest uppercase">
                ✨ MAIS POPULAR — MELHOR CUSTO-BENEFÍCIO
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{plano.icone}</span>
                    <span className="font-bold text-base">{plano.nome}</span>
                  </div>
                  {plano.economia && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{plano.economia}</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">R$ {plano.preco.toFixed(2).replace('.', ',')}</div>
                  <div className="text-xs text-muted-foreground">{plano.precoPor}</div>
                </div>
              </div>

              <ul className="space-y-2">
                {plano.recursos.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleAssinar(plano.id as 'pro' | 'anual')}
                disabled={!!loading || jaPro}
                className={`w-full h-12 rounded-xl font-bold text-sm ${
                  plano.destaque
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-accent hover:bg-accent/90 text-accent-foreground'
                }`}
              >
                {loading === plano.id ? (
                  <span className="flex items-center gap-2">⏳ Redirecionando...</span>
                ) : jaPro ? (
                  '✅ Plano ativo'
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap size={16} />
                    Assinar {plano.nome}
                  </span>
                )}
              </Button>
            </div>
          </div>
        ))}

        {/* Plano Free */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">📋 Plano Free (atual de todos)</span>
            <span className="text-xs text-muted-foreground font-bold">R$0</span>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {[
              'Registro de ponto com botão',
              'Histórico de jornadas',
              'Banco de horas básico',
              'Alertas de hora extra',
              'Configuração de turno/escala',
            ].map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-muted-foreground/60 shrink-0" />
                {r}
              </li>
            ))}
            {[
              'Relatório PDF',
              'Exportação Excel',
              'Fechamento mensal',
              'Rescisão trabalhista',
            ].map((r, i) => (
              <li key={i} className="flex items-center gap-2 opacity-50">
                <X size={12} className="text-destructive shrink-0" />
                <span className="line-through">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Segurança */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>🔒 Pagamento seguro</span>
            <span>•</span>
            <span>💳 Mercado Pago</span>
            <span>•</span>
            <span>🇧🇷 PIX, cartão</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cancele quando quiser. Sem multas ou contratos.
          </p>
        </div>

      </div>
    </div>
  );
};

export default PlanosPage;
