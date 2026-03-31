import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const SocialProofSection: React.FC = () => (
  <section className="py-24 px-6">
    <div className="max-w-2xl mx-auto text-center">
      <motion.div
        className="flex justify-center mb-6"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
      >
        <div className="flex -space-x-3">
          {['👩‍💼', '👨‍🔧', '👩‍⚕️', '👨‍💻'].map((e, i) => (
            <div key={i} className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center text-2xl shadow-md">{e}</div>
          ))}
        </div>
      </motion.div>

      <motion.h2
        className="text-2xl md:text-3xl font-bold text-foreground mb-4 tracking-tight"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
      >
        Milhares de trabalhadores já recuperaram o que é deles.
      </motion.h2>

      <motion.div
        className="flex justify-center gap-1 mb-5"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2}
      >
        {Array(5).fill(0).map((_, i) => (
          <Star key={i} className="h-5 w-5 fill-primary text-primary" />
        ))}
      </motion.div>

      <motion.p
        className="text-base text-muted-foreground italic leading-relaxed max-w-lg mx-auto"
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={3}
      >
        "Antes do Hora Justa eu nem sabia que o adicional noturno incidia sobre o descanso semanal. Identifiquei mais de 3 mil reais em diferenças estimadas."
      </motion.p>
    </div>
  </section>
);

export default SocialProofSection;
