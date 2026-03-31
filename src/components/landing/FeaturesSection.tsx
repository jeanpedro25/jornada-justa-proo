import React from 'react';
import { motion } from 'framer-motion';
import { PenLine, Calculator, FileText } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const features = [
  {
    icon: PenLine,
    title: 'Registro fácil',
    text: 'Anote suas horas em segundos com nossa interface intuitiva de um clique.',
  },
  {
    icon: Calculator,
    title: 'Estimativa precisa',
    text: 'Algoritmos atualizados com as últimas leis trabalhistas brasileiras.',
  },
  {
    icon: FileText,
    title: 'Relatórios profissionais',
    text: 'Documentos prontos para apresentar ao RH ou para assessoria jurídica.',
  },
];

const FeaturesSection: React.FC = () => (
  <section className="py-24 px-6">
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
      {features.map((item, i) => (
        <motion.div
          key={i}
          className="flex gap-5"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={i}
        >
          <item.icon className="h-7 w-7 text-primary shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-lg text-foreground mb-2">{item.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);

export default FeaturesSection;
