import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LEGAL_COPY } from '@/lib/legal-copy';

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const PricingSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="precos" className="py-24 bg-surface-low px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Controle total da sua jornada
          </h2>
          <p className="text-muted-foreground mt-3">Cancele quando quiser</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Mensal */}
          <motion.div
            className="bg-card p-10 rounded-[2rem] flex flex-col"
            variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Plano Mensal</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-foreground">R$ 9,90</span>
              <span className="text-muted-foreground text-sm">/mês</span>
            </div>
            <ul className="space-y-3 mb-10 flex-1">
              {['Cálculos ilimitados', 'Relatórios em PDF', 'Banco de horas'].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-full h-13 rounded-xl font-bold text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => navigate('/auth')}
            >
              Assinar Mensal
            </Button>
          </motion.div>

          {/* Anual */}
          <motion.div
            className="bg-primary text-primary-foreground p-10 rounded-[2.5rem] flex flex-col shadow-2xl shadow-primary/20 relative md:scale-105"
            variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2}
          >
            <div className="absolute top-5 right-5 bg-accent-container text-primary px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Mais Popular
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-container mb-4">Plano Anual</p>
            <div className="mb-2">
              <span className="text-5xl font-extrabold">R$ 89,90</span>
              <span className="opacity-80 text-sm">/ano</span>
            </div>
            <p className="text-sm opacity-70 mb-6">Valor alinhado ao checkout Mercado Pago</p>
            <ul className="space-y-3 mb-10 flex-1">
              {['Tudo do plano mensal', 'Histórico ilimitado', 'Backup na nuvem', 'Alertas inteligentes', 'Simulação de valor estimado'].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-accent-container shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full h-13 bg-accent-container text-primary rounded-xl font-bold hover:bg-white transition-colors text-base"
              onClick={() => navigate('/auth')}
            >
              Assinar Anual
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-8">
          {LEGAL_COPY.subscription}
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
