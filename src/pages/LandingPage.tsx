import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Shield, BarChart3, FileText, CheckCircle, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <span className="text-lg font-bold text-primary">⏱ Hora Justa</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
            Já tenho conta
          </Button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h1
            className="text-3xl md:text-5xl font-extrabold leading-tight text-primary"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Descubra quanto você pode estar{' '}
            <span className="text-accent">perdendo</span> em horas extras
          </motion.h1>

          <motion.p
            className="mt-4 text-base md:text-lg text-muted-foreground max-w-lg mx-auto"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Controle sua jornada de trabalho e veja uma estimativa do valor das suas horas extras em poucos dias.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center gap-3"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <Button
              size="lg"
              className="w-full max-w-xs h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
              onClick={() => navigate('/auth')}
            >
              Começar grátis por 14 dias
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
            <span className="text-xs text-muted-foreground">Sem compromisso • Cancele quando quiser</span>
          </motion.div>

          {/* Mock card */}
          <motion.div
            className="mt-10 mx-auto max-w-xs bg-card border border-border rounded-2xl p-6 shadow-xl"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <p className="text-sm text-muted-foreground">O patrão te deve este mês</p>
            <p className="text-4xl font-extrabold text-success mt-1">R$ 487,00</p>
            <p className="text-xs text-muted-foreground mt-2">32h extras acumuladas</p>
          </motion.div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-16 px-4 bg-primary">
        <div className="max-w-2xl mx-auto text-center">
          <motion.p
            className="text-xl md:text-2xl font-bold text-primary-foreground leading-snug"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            A maioria dos trabalhadores não sabe quantas horas extras faz…{' '}
            <span className="text-accent">e muito menos quanto dinheiro deixa de receber.</span>
          </motion.p>
          <motion.p
            className="mt-6 text-base text-primary-foreground/70"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            Empresas controlam seu ponto. Mas você não.
          </motion.p>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-center text-primary"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Tenha o controle da sua jornada na sua mão
          </motion.h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {[
              { icon: Clock, text: 'Registre entrada e saída facilmente' },
              { icon: BarChart3, text: 'Acompanhe suas horas extras' },
              { icon: Star, text: 'Veja estimativas de valores' },
              { icon: FileText, text: 'Gere relatórios organizados' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-4 p-5 bg-card border border-border rounded-2xl"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm font-medium text-foreground">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACTO */}
      <section className="py-16 px-4 bg-secondary">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-primary"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Veja quanto você pode estar perdendo
          </motion.h2>

          <motion.div
            className="mt-8 mx-auto max-w-sm bg-card border-2 border-accent rounded-2xl p-8 shadow-lg"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            <p className="text-sm text-muted-foreground">Em 1 mês, você pode acumular:</p>
            <p className="text-5xl font-extrabold text-accent mt-3">20h</p>
            <p className="text-sm text-muted-foreground mt-1">horas extras</p>
            <div className="mt-4 h-px bg-border" />
            <p className="mt-4 text-2xl font-bold text-success">≈ R$ 300 a R$ 800</p>
            <p className="text-xs text-muted-foreground mt-1">em valores estimados</p>
          </motion.div>

          <motion.p
            className="mt-6 text-base font-semibold text-primary"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
          >
            Tudo isso sem perceber.
          </motion.p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-center text-primary"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Como funciona
          </motion.h2>

          <div className="mt-10 space-y-6">
            {[
              { step: '1', text: 'Registre seus horários' },
              { step: '2', text: 'O app calcula automaticamente' },
              { step: '3', text: 'Veja estimativa de horas extras' },
              { step: '4', text: 'Gere relatórios completos' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-4"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <p className="text-base font-medium text-foreground">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇO */}
      <section className="py-16 px-4 bg-secondary">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-primary"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Comece grátis hoje
          </motion.h2>
          <motion.p
            className="mt-2 text-sm text-muted-foreground"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            14 dias grátis • Sem compromisso
          </motion.p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-md mx-auto">
            {/* Mensal */}
            <motion.div
              className="bg-card border border-border rounded-2xl p-6"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={2}
            >
              <p className="text-sm text-muted-foreground font-medium">Mensal</p>
              <p className="text-3xl font-extrabold text-primary mt-2">R$ 9,90</p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </motion.div>

            {/* Anual */}
            <motion.div
              className="bg-card border-2 border-accent rounded-2xl p-6 relative"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={3}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Mais popular
              </span>
              <p className="text-sm text-muted-foreground font-medium">Anual</p>
              <p className="text-3xl font-extrabold text-primary mt-2">R$ 79,90</p>
              <p className="text-xs text-muted-foreground">/ano</p>
              <p className="text-xs font-semibold text-accent mt-1">Menos de R$ 6,70/mês</p>
            </motion.div>
          </div>

          <motion.div
            className="mt-8"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={4}
          >
            <Button
              size="lg"
              className="w-full max-w-xs h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
              onClick={() => navigate('/auth')}
            >
              Começar agora
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex items-start gap-3 bg-card border border-border rounded-2xl p-5">
          <Shield className="shrink-0 h-5 w-5 text-accent mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Os dados são informados pelo usuário e apresentados como estimativas para controle pessoal.
            Não substitui orientação jurídica. Seus dados ficam salvos com segurança e não são compartilhados.
          </p>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 px-4 bg-primary">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-primary-foreground"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Descubra agora quanto você pode estar perdendo
          </motion.h2>
          <motion.div
            className="mt-8 flex flex-col items-center gap-3"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            <Button
              size="lg"
              className="w-full max-w-xs h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
              onClick={() => navigate('/auth')}
            >
              Começar grátis
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="text-primary-foreground/70 hover:text-primary-foreground"
              onClick={() => navigate('/auth')}
            >
              Já tenho conta
            </Button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-6 px-4 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground">
          Os registros são de responsabilidade do usuário. Valores são estimativas.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">© {new Date().getFullYear()} Hora Justa</p>
      </footer>
    </div>
  );
};

export default LandingPage;
