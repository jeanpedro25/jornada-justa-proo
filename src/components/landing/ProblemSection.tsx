import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Moon, CalendarOff } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const problems = [
  {
    icon: Clock,
    title: 'Intervalos Ignorados',
    text: 'Minutos que somam horas no final do mês e nunca aparecem no seu holerite.',
  },
  {
    icon: Moon,
    title: 'Adicional Noturno',
    text: 'Cálculos complexos que as empresas costumam simplificar contra o trabalhador.',
  },
  {
    icon: CalendarOff,
    title: 'Feriados e Domingos',
    text: 'O valor dobrado que muitas vezes é pago como hora comum por "erro" de sistema.',
  },
];

const ProblemSection: React.FC = () => (
  <section id="problema" className="py-24 bg-surface-low">
    <div className="max-w-5xl mx-auto px-6">
      <motion.h2
        className="text-3xl md:text-4xl font-bold text-center text-foreground mb-16 tracking-tight"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
      >
        Onde o seu dinheiro desaparece?
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {problems.map((item, i) => (
          <motion.div
            key={i}
            className="bg-card p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={i + 1}
          >
            <div className="w-12 h-12 rounded-xl bg-accent-container/10 flex items-center justify-center mb-5">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSection;
