import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FinalCTASection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="py-28 px-6 text-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-accent-container/15 blur-[150px] rounded-full -z-10" />

      <motion.h2
        className="text-3xl md:text-5xl font-extrabold text-foreground mb-6 tracking-tight max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        Pronto para receber o que é seu?
      </motion.h2>

      <motion.p
        className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.6 }}
      >
        Junte-se a milhares de trabalhadores que pararam de aceitar cálculos errados.
      </motion.p>

      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <Button
          size="lg"
          className="h-16 px-12 text-lg font-extrabold rounded-2xl bg-gradient-to-r from-primary to-accent-container text-primary-foreground shadow-2xl shadow-primary/15 transition-all hover:scale-105 active:scale-95"
          onClick={() => navigate('/auth')}
        >
          Começar agora
          <ChevronRight className="ml-2 h-6 w-6" />
        </Button>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          onClick={() => navigate('/auth')}
        >
          Já tenho conta
        </button>
      </motion.div>
    </section>
  );
};

export default FinalCTASection;
