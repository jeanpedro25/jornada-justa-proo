import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.14, duration: 0.7, ease: 'easeOut' as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay: i * 0.14, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pt-28 pb-24 px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-1/4 w-[600px] h-[600px] rounded-full bg-accent-container/10 blur-[120px]" />
        <div className="absolute top-40 -left-20 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16 relative">
        {/* Left — Copy */}
        <div className="flex-1 space-y-7 text-center md:text-left">
          <motion.h1
            className="text-4xl md:text-[3.5rem] font-extrabold leading-[1.08] tracking-tight text-foreground"
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
          >
            Pare de perder{' '}
            <span className="bg-gradient-to-r from-primary to-accent-container bg-clip-text text-transparent">
              dinheiro.
            </span>
          </motion.h1>

          <motion.p
            className="text-lg text-muted-foreground max-w-lg mx-auto md:mx-0 leading-relaxed"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
          >
            Descubra exatamente quanto você deve receber de horas extras com a precisão de um especialista.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center gap-4"
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
          >
            <Button
              size="lg"
              className="h-14 px-8 text-base font-bold rounded-2xl bg-gradient-to-r from-primary to-accent-container text-primary-foreground shadow-xl shadow-primary/15 transition-all hover:shadow-2xl hover:shadow-primary/25 hover:-translate-y-0.5 hover:scale-[1.02]"
              onClick={() => navigate('/auth')}
            >
              Começar agora grátis
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['😊', '💪', '⭐', '🎯'].map((e, i) => (
                  <div key={i} className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center text-sm">{e}</div>
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground">+10k usuários</span>
            </div>
          </motion.div>
        </div>

        {/* Right — Damage card */}
        <motion.div
          className="flex-1 w-full max-w-md relative"
          variants={scaleIn} initial="hidden" animate="visible" custom={3}
        >
          <div className="absolute -z-10 inset-0 bg-accent-container/15 blur-[80px] rounded-full scale-110" />
          <div className="bg-card p-8 rounded-3xl shadow-2xl shadow-primary/5 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Prejuízo Estimado</p>
                <h2 className="text-4xl font-extrabold text-destructive mt-1 tracking-tight">R$ 1.450,80</h2>
              </div>
              <div className="bg-destructive text-destructive-foreground p-3 rounded-xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>

            <div className="h-3 bg-surface-low rounded-full overflow-hidden mb-6">
              <div className="h-full bg-destructive w-3/4 rounded-full" />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between p-4 bg-surface-low rounded-xl">
                <span className="text-sm text-muted-foreground">Horas não pagas</span>
                <span className="text-sm font-bold text-foreground">12,5h</span>
              </div>
              <div className="flex justify-between p-4 bg-surface-low rounded-xl">
                <span className="text-sm text-muted-foreground">Adicional Noturno</span>
                <span className="text-sm font-bold text-foreground">R$ 420,00</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
