import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, BarChart3, FileText, ChevronRight, Zap, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HoraJustaLogo from '@/components/HoraJustaLogo';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
              <Clock className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">Hora Justa</span>
          </div>
          <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold" onClick={() => navigate('/auth')}>
            Entrar
          </Button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-28 pb-20 px-5">
        {/* Decorative gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/8 blur-3xl" />
          <div className="absolute top-20 -right-20 w-[300px] h-[300px] rounded-full bg-accent/5 blur-2xl" />
        </div>

        <div className="max-w-2xl mx-auto text-center relative">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6 border border-accent/20"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <Zap className="h-3.5 w-3.5" />
            14 dias grátis • Sem cartão de crédito
          </motion.div>

          <motion.h1
            className="text-4xl md:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight text-foreground"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Descubra quanto você está{' '}
            <span className="bg-gradient-to-r from-accent to-[hsl(174,58%,40%)] bg-clip-text text-transparent">
              perdendo
            </span>{' '}
            em horas extras
          </motion.h1>

          <motion.p
            className="mt-5 text-base md:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            Controle sua jornada de trabalho e veja uma estimativa do valor das suas horas extras.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center gap-3"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <Button
              size="lg"
              className="w-full max-w-[280px] h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
              onClick={() => navigate('/auth')}
            >
              Começar grátis
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>

          {/* Hero Card */}
          <motion.div
            className="mt-12 mx-auto max-w-[320px] relative"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-2xl scale-90" />
            <div className="relative bg-card border border-border/60 rounded-3xl p-7 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-xs text-muted-foreground font-medium">Atualizado agora</p>
              </div>
              <p className="text-sm text-muted-foreground">O patrão te deve este mês</p>
              <p className="text-5xl font-extrabold text-success mt-2 tracking-tight">R$ 487</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 bg-success/10 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Horas extras</p>
                  <p className="text-sm font-bold text-success">32h</p>
                </div>
                <div className="flex-1 bg-warning/10 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Dias registrados</p>
                  <p className="text-sm font-bold text-warning">22</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-20 px-5 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <div className="max-w-xl mx-auto text-center relative">
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/10 text-primary-foreground/60 text-xs font-medium mb-6"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            O PROBLEMA
          </motion.div>
          <motion.p
            className="text-2xl md:text-3xl font-bold text-primary-foreground leading-snug"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            A maioria dos trabalhadores não sabe quantas horas extras faz…{' '}
            <span className="text-accent">e muito menos quanto dinheiro deixa de receber.</span>
          </motion.p>
          <motion.div
            className="mt-8 flex items-center justify-center gap-3"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
          >
            <div className="h-px flex-1 max-w-[60px] bg-primary-foreground/20" />
            <p className="text-sm text-primary-foreground/50 font-medium">
              Empresas controlam seu ponto. Mas você não.
            </p>
            <div className="h-px flex-1 max-w-[60px] bg-primary-foreground/20" />
          </motion.div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto">
          <motion.div
            className="text-center mb-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">A Solução</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Tenha o controle da sua jornada na sua mão
            </h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Clock, title: 'Registro fácil', text: 'Entrada e saída com um toque' },
              { icon: BarChart3, title: 'Horas extras', text: 'Acompanhe em tempo real' },
              { icon: TrendingUp, title: 'Estimativas', text: 'Veja quanto o patrão te deve' },
              { icon: FileText, title: 'Relatórios', text: 'PDF completo para download' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="group relative bg-card border border-border/60 rounded-2xl p-5 hover:border-accent/40 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* IMPACTO */}
      <section className="py-20 px-5 bg-secondary/50">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">Impacto Real</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Veja quanto você pode estar perdendo
            </h2>
          </motion.div>

          <motion.div
            className="mt-10 mx-auto max-w-sm relative"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            <div className="absolute inset-0 bg-accent/10 rounded-3xl blur-2xl scale-95" />
            <div className="relative bg-card border-2 border-accent/30 rounded-3xl p-8 shadow-xl">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Em 1 mês você pode acumular</p>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-6xl font-extrabold text-accent tracking-tighter">20</span>
                <span className="text-lg font-bold text-accent">horas</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">de horas extras</p>
              <div className="mt-5 h-px bg-border" />
              <p className="mt-5 text-2xl font-bold text-success">R$ 300 – R$ 800</p>
              <p className="text-xs text-muted-foreground mt-1">em valores estimados</p>
              <div className="mt-5 bg-destructive/8 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-destructive">💸 Tudo isso sem perceber.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 px-5">
        <div className="max-w-xl mx-auto">
          <motion.div
            className="text-center mb-12"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">Simples</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Como funciona
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              { step: '1', text: 'Registre seus horários', desc: 'Entrada e saída com um clique' },
              { step: '2', text: 'Cálculo automático', desc: 'O app faz as contas pra você' },
              { step: '3', text: 'Veja suas horas extras', desc: 'Acompanhe o saldo diário' },
              { step: '4', text: 'Baixe relatórios', desc: 'PDF completo quando precisar' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-4 bg-card border border-border/60 rounded-2xl p-4 hover:border-accent/30 transition-all"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="shrink-0 w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-base shadow-md shadow-accent/20">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇO */}
      <section className="py-20 px-5 bg-secondary/50">
        <div className="max-w-lg mx-auto text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest">Preços</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Comece grátis hoje
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">14 dias grátis • Cancele quando quiser</p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <motion.div
              className="bg-card border border-border/60 rounded-2xl p-6 text-center"
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
            >
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Mensal</p>
              <div className="mt-3 flex items-baseline justify-center gap-0.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="text-4xl font-extrabold text-foreground">9,90</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
            </motion.div>

            <motion.div
              className="relative bg-card border-2 border-accent rounded-2xl p-6 text-center shadow-lg shadow-accent/10"
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={2}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
                ⭐ Mais popular
              </span>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Anual</p>
              <div className="mt-3 flex items-baseline justify-center gap-0.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="text-4xl font-extrabold text-foreground">79,90</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">/ano</p>
              <p className="text-xs font-bold text-accent mt-2">≈ R$ 6,66/mês — economize 33%</p>
            </motion.div>
          </div>

          <motion.div
            className="mt-10"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={3}
          >
            <Button
              size="lg"
              className="w-full max-w-[280px] h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
              onClick={() => navigate('/auth')}
            >
              Começar agora
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section className="py-10 px-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start gap-3 bg-card border border-border/60 rounded-2xl p-5">
            <Shield className="shrink-0 h-5 w-5 text-accent mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Os dados são informados pelo usuário e apresentados como estimativas para controle pessoal.
              Não substitui orientação jurídica. Seus dados ficam salvos com segurança e não são compartilhados.
            </p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-5 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent/8 blur-3xl" />
        </div>
        <div className="max-w-xl mx-auto text-center relative">
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            Descubra agora quanto você pode estar perdendo
          </motion.h2>
          <motion.div
            className="mt-8 flex flex-col items-center gap-4"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            <Button
              size="lg"
              className="w-full max-w-[280px] h-14 text-base font-bold rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
              onClick={() => navigate('/auth')}
            >
              Começar grátis
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
            <button
              className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors underline underline-offset-4"
              onClick={() => navigate('/auth')}
            >
              Já tenho conta
            </button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-5 border-t border-border/50 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
            <Clock className="h-3 w-3 text-accent-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">Hora Justa</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Os registros são de responsabilidade do usuário. Valores são estimativas.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">© {new Date().getFullYear()} Hora Justa</p>
      </footer>
    </div>
  );
};

export default LandingPage;
