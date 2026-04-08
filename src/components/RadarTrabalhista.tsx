import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Info, ChevronDown, ChevronUp, Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AlertaRadar, NivelAlerta } from '@/lib/radar-trabalhista';
import { formatCurrency } from '@/lib/formatters';

interface RadarTrabalhistaProps {
  alertas: AlertaRadar[];
  isPro: boolean;
}

const nivelConfig: Record<NivelAlerta, {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: React.ReactNode;
  badge: string;
}> = {
  alto: {
    label: 'Atenção Prioritária',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: <ShieldAlert size={15} className="text-red-500 shrink-0 mt-0.5" />,
    badge: 'bg-red-500 text-white',
  },
  medio: {
    label: 'Verificar',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    icon: <AlertTriangle size={15} className="text-orange-400 shrink-0 mt-0.5" />,
    badge: 'bg-orange-400 text-white',
  },
  baixo: {
    label: 'Informativo',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />,
    badge: 'bg-blue-400 text-white',
  },
};

const AlertaCard: React.FC<{ alerta: AlertaRadar; isPro: boolean; index: number }> = ({ alerta, isPro, index }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = nivelConfig[alerta.nivel];
  const bloqueado = !isPro && index >= 2;

  if (bloqueado) {
    return (
      <div className="relative rounded-xl border border-border p-4 bg-muted/30 overflow-hidden">
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-10">
          <div className="text-center space-y-1">
            <Lock size={18} className="text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground font-semibold">PRO — Ver alerta completo</p>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none">
          <div className="flex items-start gap-2">
            {cfg.icon}
            <p className="text-sm font-semibold">{alerta.titulo}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{alerta.descricao}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${cfg.bg} ${cfg.border} overflow-hidden transition-all`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${cfg.text} leading-tight`}>{alerta.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alerta.periodo}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label.toUpperCase()}
            </span>
            {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className={`px-4 pb-4 space-y-2.5 border-t ${cfg.border}`}>
          <p className="text-xs text-foreground/80 leading-relaxed pt-3">{alerta.descricao}</p>

          <div className={`rounded-lg p-2.5 ${cfg.bg} border ${cfg.border}`}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Recomendação</p>
            <p className="text-xs text-foreground/70 leading-relaxed">{alerta.recomendacao}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/70 italic">{alerta.referenciaCLT}</p>
            {isPro && alerta.valorEstimado && alerta.valorEstimado > 0 && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg px-2 py-1">
                <p className="text-[9px] text-muted-foreground">Estimativa</p>
                <p className="text-xs font-bold text-accent">~{formatCurrency(alerta.valorEstimado)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RadarTrabalhista: React.FC<RadarTrabalhistaProps> = ({ alertas, isPro }) => {
  const navigate = useNavigate();

  const totalAlto = alertas.filter(a => a.nivel === 'alto').length;
  const totalMedio = alertas.filter(a => a.nivel === 'medio').length;
  const alertasOrdenados = [...alertas].sort((a, b) => {
    const ordem = { alto: 0, medio: 1, baixo: 2 };
    return ordem[a.nivel] - ordem[b.nivel];
  });

  const alertasBloqueados = !isPro ? Math.max(0, alertas.length - 2) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <ShieldAlert size={16} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Radar Trabalhista</h2>
            <p className="text-[10px] text-slate-400">Pontos de Atenção</p>
          </div>
        </div>

        {alertas.length > 0 && (
          <p className="text-[11px] text-slate-300 leading-relaxed italic">
            "Com base nos dados informados, foram identificados padrões que podem indicar necessidade de revisão da jornada, conforme diretrizes da CLT."
          </p>
        )}

        {alertas.length > 0 && (
          <div className="flex gap-2 mt-3">
            {totalAlto > 0 && (
              <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded-lg px-2 py-1">
                <ShieldAlert size={11} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-bold">{totalAlto} alto</span>
              </div>
            )}
            {totalMedio > 0 && (
              <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/40 rounded-lg px-2 py-1">
                <AlertTriangle size={11} className="text-orange-400" />
                <span className="text-[10px] text-orange-300 font-bold">{totalMedio} médio</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {alertas.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Nenhum ponto identificado</p>
            <p className="text-xs text-muted-foreground">
              Não foram identificados pontos relevantes com base nos dados analisados.
            </p>
          </div>
        ) : (
          <>
            {alertasOrdenados.map((alerta, i) => (
              <AlertaCard key={alerta.id} alerta={alerta} isPro={isPro} index={i} />
            ))}

            {alertasBloqueados > 0 && (
              <button
                onClick={() => navigate('/planos')}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 hover:from-accent/20 hover:to-accent/10 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-accent" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs font-bold text-accent">Desbloqueie {alertasBloqueados} alerta{alertasBloqueados > 1 ? 's' : ''} oculto{alertasBloqueados > 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-muted-foreground">PRO — Ver todos com valores estimados</p>
                </div>
                <span className="text-xs text-accent font-bold">Ver planos →</span>
              </button>
            )}
          </>
        )}

        {/* Aviso legal obrigatório */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mt-1">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
            <span className="font-bold">⚖️ Aviso Legal:</span> Este relatório apresenta análises e estimativas baseadas nas informações fornecidas pelo usuário e não constitui parecer jurídico, podendo variar conforme regras específicas da empresa e legislação vigente.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RadarTrabalhista;
