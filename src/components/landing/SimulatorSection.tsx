import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { LEGAL_COPY } from '@/lib/legal-copy';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const SimulatorSection: React.FC = () => {
  const navigate = useNavigate();
  const [salario, setSalario] = useState(3500);
  const [horasExtras, setHorasExtras] = useState(20);

  const resultado = useMemo(() => {
    const valorHora = salario / 220;
    const extra50 = valorHora * 1.5 * horasExtras;
    const diferenca = valorHora * 0.5 * horasExtras;
    return { total: extra50, diferenca };
  }, [salario, horasExtras]);

  return (
    <section id="simulador" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="bg-surface-low p-8 md:p-12 rounded-[2rem] flex flex-col md:flex-row gap-12 items-center"
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
        >
          {/* Left — sliders */}
          <div className="flex-1 space-y-8 w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Simule uma estimativa agora
            </h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Salário Base</label>
                  <span className="text-sm font-bold text-primary">
                    R$ {salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Slider
                  value={[salario]}
                  onValueChange={([v]) => setSalario(v)}
                  min={1412}
                  max={20000}
                  step={100}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Horas extras mensais</label>
                  <span className="text-sm font-bold text-primary">{horasExtras} horas</span>
                </div>
                <Slider
                  value={[horasExtras]}
                  onValueChange={([v]) => setHorasExtras(v)}
                  min={0}
                  max={60}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {LEGAL_COPY.simulatorDisclaimer}
            </p>
          </div>

          {/* Right — result card */}
          <div className="flex-1 w-full">
            <div className="bg-primary text-primary-foreground p-10 rounded-3xl shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <TrendingUp className="h-20 w-20" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-accent-container mb-2">
                Estimativa de Ganhos
              </p>
              <h3 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-6">
                R$ {resultado.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-accent">
                  + R$ {resultado.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de diferença estimada
                </span>
              </div>
              <Button
                className="w-full h-13 bg-accent-container text-primary font-bold rounded-xl hover:bg-white transition-colors text-base"
                onClick={() => navigate('/auth')}
              >
                Simular com meus dados
                <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              <p className="text-[9px] text-primary-foreground/50 mt-3 text-center">
                *Valores meramente estimativos.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SimulatorSection;
