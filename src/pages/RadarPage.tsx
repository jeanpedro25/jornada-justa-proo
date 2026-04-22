import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import {
  ShieldAlert, AlertTriangle, ChevronDown, ChevronUp,
  ArrowLeft, BookOpen, Zap, CheckCircle2, DollarSign,
  Activity, HeartPulse, Scale, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchBancoHorasEntries, summarizeBancoHoras,
  type BancoHorasEntry,
} from '@/lib/banco-horas';
import { getCargaDiaria } from '@/lib/jornada';
import { getCicloQuery } from '@/lib/ciclo-folha';
import { usePlano } from '@/hooks/usePlano';
import { analisarRadarTrabalhista, RADAR_ISENCAO_RODAPE, type AlertaRadar, type NivelAlerta } from '@/lib/radar-trabalhista';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyOrigin(marks: any[]): 'real' | 'reconstituido' | 'manual' {
  if (!marks.length) return 'manual';
  const origens = marks.map(m => m.origem || 'manual');
  if (origens.every((o: string) => o === 'importacao_automatica')) return 'reconstituido';
  if (origens.some((o: string) => o === 'botao')) return 'real';
  return 'manual';
}

const nivelCfg: Record<NivelAlerta, { bg: string; border: string; textTitle: string; badge: string; badgeText: string; dot: string; color: string }> = {
  alto:  { bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-200 dark:border-red-800',     textTitle: 'text-red-700 dark:text-red-300',      badge: 'bg-red-500',    badgeText: 'CRÍTICO', dot: 'bg-red-500', color: '#ef4444' },
  medio: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', textTitle: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-400', badgeText: 'VERIFICAR', dot: 'bg-orange-400', color: '#f97316' },
  baixo: { bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800',   textTitle: 'text-blue-700 dark:text-blue-300',     badge: 'bg-blue-400',   badgeText: 'INFORMATIVO', dot: 'bg-blue-400', color: '#3b82f6' },
};

const CATEGORIAS_MAP: Record<string, { nome: string; icon: React.ReactNode }> = {
  extras_excessivas: { nome: 'Sobrecarga', icon: <Activity size={16} /> },
  semana_44h: { nome: 'Sobrecarga', icon: <Activity size={16} /> },
  jornada_10h: { nome: 'Sobrecarga', icon: <Activity size={16} /> },
  intervalo_6h: { nome: 'Saúde & Descanso', icon: <HeartPulse size={16} /> },
  intervalo_4h: { nome: 'Saúde & Descanso', icon: <HeartPulse size={16} /> },
  sequencia_dias_labor: { nome: 'Saúde & Descanso', icon: <HeartPulse size={16} /> },
  interjornada_11h: { nome: 'Saúde & Descanso', icon: <HeartPulse size={16} /> },
  trabalho_noturno: { nome: 'Adicionais', icon: <DollarSign size={16} /> },
  banco_horas_vencido: { nome: 'Banco de Horas', icon: <Scale size={16} /> },
  banco_horas_elevado: { nome: 'Banco de Horas', icon: <Scale size={16} /> },
  feriados_trabalhados: { nome: 'Feriados & Férias', icon: <AlertCircle size={16} /> },
  ferias_pendentes: { nome: 'Feriados & Férias', icon: <AlertCircle size={16} /> },
  domingos_trabalhados: { nome: 'Feriados & Férias', icon: <AlertCircle size={16} /> },
};

// ─── Card de Alerta ───────────────────────────────────────────────────────────

const AlertaCard: React.FC<{ alerta: AlertaRadar; isPro: boolean; idx: number }> = ({ alerta, isPro, idx }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const cfg = nivelCfg[alerta.nivel];
  const bloqueado = !isPro && idx >= 2;
  const categoria = CATEGORIAS_MAP[alerta.id] || { nome: 'Outros', icon: <ShieldAlert size={16} /> };

  if (bloqueado) {
    return (
      <div className="relative rounded-3xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-1">
            <Zap size={24} className="text-accent" />
          </div>
          <p className="text-sm font-black text-accent">PRO — Alerta Oculto</p>
          <p className="text-[10px] text-muted-foreground px-8 text-center mb-2">
            Desbloqueie para ver o impacto financeiro e a recomendação completa.
          </p>
          <button onClick={() => navigate('/planos')}
            className="text-xs bg-accent text-accent-foreground px-6 py-2.5 rounded-full font-bold shadow-lg shadow-accent/20 transition-transform active:scale-95">
            Desbloquear Agora
          </button>
        </div>
        <div className="opacity-20 pointer-events-none p-5">
          <div className="flex gap-3 items-start">
            <span className="text-3xl grayscale">{alerta.emoji}</span>
            <div>
              <p className="font-bold text-base blur-[2px]">{alerta.titulo}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 blur-[2px]">{alerta.narrativa}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border shadow-sm transition-all duration-300 ${open ? 'ring-2 ring-opacity-50 ring-offset-2 ring-offset-background' : ''} ${cfg.bg} ${cfg.border} overflow-hidden ${open ? cfg.border.replace('border-', 'ring-') : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full p-5 text-left active:scale-[0.99] transition-transform">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white/50 dark:bg-black/20 shadow-sm border ${cfg.border}`}>
            <span className="text-2xl">{alerta.emoji}</span>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[9px] font-black text-white px-2 py-0.5 rounded-full shrink-0 ${cfg.badge} shadow-sm`}>
                {cfg.badgeText}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                {categoria.icon} {categoria.nome}
              </span>
            </div>
            <p className={`text-sm font-bold leading-snug ${cfg.textTitle}`}>{alerta.titulo}</p>
          </div>
          <div className="shrink-0 mt-3 bg-white/50 dark:bg-black/20 p-1.5 rounded-full">
            {open ? <ChevronUp size={16} className={cfg.textTitle} /> : <ChevronDown size={16} className={cfg.textTitle} />}
          </div>
        </div>
      </button>

      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className={`px-5 pb-5 pt-2 border-t ${cfg.border} space-y-4`}>
            {/* Dinheiro na Mesa */}
            {alerta.valorEstimado && alerta.valorEstimado > 0 && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-widest mb-0.5">Impacto Financeiro Estimado</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                    R$ {alerta.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {/* Narrativa */}
            <div className="pt-2">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-2">📋 Detalhes do Alerta</p>
              <p className="text-[13px] text-foreground/90 leading-relaxed font-medium">{alerta.narrativa}</p>
            </div>

            {/* Ocorrências - Linha do tempo visual */}
            {alerta.ocorrencias && alerta.ocorrencias.length > 0 && (
              <div className={`rounded-2xl p-4 bg-white/40 dark:bg-black/20 border ${cfg.border}`}>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-3 tracking-wider">📆 Datas Críticas Identificadas</p>
                <div className="space-y-2.5 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-gradient-to-b before:from-current before:to-transparent before:opacity-10">
                  {alerta.ocorrencias.map((oc, i) => (
                    <div key={i} className="flex items-start gap-3 relative z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white dark:bg-background shadow-sm border-2 ${cfg.border}`}>
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      </div>
                      <p className="text-xs font-semibold text-foreground/80 mt-1">{oc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendação */}
            <div className="bg-foreground/5 dark:bg-foreground/10 rounded-2xl p-4">
              <p className="text-[10px] text-foreground/60 uppercase font-bold mb-2 tracking-wider">💡 Recomendação Prática</p>
              <p className="text-xs text-foreground/90 leading-relaxed">{alerta.recomendacao}</p>
            </div>

            {/* Rodapé Legal */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1">
                <BookOpen size={10} /> Base Legal: {alerta.clt}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const RadarPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const plano = usePlano();
  const p = profile as any;

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<any[]>([]);
  const [bancoEntries, setBancoEntries] = useState<BancoHorasEntry[]>([]);
  const [saldoFinal, setSaldoFinal] = useState(0);

  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;
  const carga = getCargaDiaria(p?.tipo_jornada || 'jornada_fixa', p?.escala_tipo || null, p?.carga_horaria_diaria ?? 8, p);

  useEffect(() => {
    if (!user) return;
    const carregar = async () => {
      setLoading(true);
      try {
        const diaFechamento = (p?.dia_fechamento_folha as number) ?? 0;
        const { start, end } = getCicloQuery(diaFechamento);

        // Marcações
        const { data: marcData } = await supabase
          .from('marcacoes_ponto').select('*').eq('user_id', user.id)
          .is('deleted_at', null).gte('data', start).lte('data', end)
          .order('horario', { ascending: true });

        // Banco de horas
        const bh = await fetchBancoHorasEntries(user.id);
        setBancoEntries(bh);

        // Compensações
        const { data: compData } = await supabase.from('compensacoes_banco_horas')
          .select('minutos').eq('user_id', user.id);
        const totalComp = (compData || []).reduce((s: number, c: any) => s + c.minutos, 0);

        // Férias
        const { data: ferData } = await supabase.from('ferias').select('*')
          .eq('user_id', user.id).in('status', ['ativa', 'agendada', 'concluida']);

        // Build simple day summaries from marcacoes for radar
        const dayMap = new Map<string, any[]>();
        (marcData || []).forEach((m: any) => {
          if (!dayMap.has(m.data)) dayMap.set(m.data, []);
          dayMap.get(m.data)!.push(m);
        });

        const { calcularJornada } = await import('@/lib/jornada');
        const cargaMin = carga * 60;

        // Feriados
        const { getFeriadosDoAno } = await import('@/lib/feriados');
        const anoI = parseInt(start.substring(0, 4));
        const anoF = parseInt(end.substring(0, 4));
        const feriadoMap = new Map<string, string>();
        for (let a = anoI; a <= anoF; a++) {
          getFeriadosDoAno(a).forEach((f: any) => { if (f.data >= start && f.data <= end) feriadoMap.set(f.data, f.nome); });
        }

        const feriasSet = new Set<string>();
        (ferData || []).forEach((f: any) => {
          let d = new Date(f.data_inicio + 'T12:00:00');
          const ef = new Date(f.data_fim + 'T12:00:00');
          while (d <= ef) { feriasSet.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
        });

        const summaries: any[] = [];
        let cur = new Date(start + 'T12:00:00');
        const endD = new Date(end + 'T12:00:00');
        const hj = new Date().toISOString().split('T')[0];
        while (cur <= endD && cur.toISOString().split('T')[0] <= hj) {
          const ds = cur.toISOString().split('T')[0];
          const marks = dayMap.get(ds) || [];
          const feriado = feriadoMap.get(ds);
          const eFerias = feriasSet.has(ds);
          const dow = cur.getDay();
          const ehDia = dow >= 1 && dow <= (p?.dias_trabalhados_semana ?? 5);

          if (feriado) {
            const j = marks.length > 0 ? calcularJornada(marks, cargaMin) : null;
            const ro = marks.length > 0 ? classifyOrigin(marks) : null;
            summaries.push({
              data: ds, totalMin: j?.totalTrabalhado || 0, extraMin: j?.totalTrabalhado || 0, intervaloMin: j?.totalIntervalo || 0,
              origem: 'feriado', feriadoNome: feriado, marcacoes: marks, ehDiaTrabalho: true, registroOrigem: ro,
            });
          } else if (eFerias) {
            summaries.push({ data: ds, totalMin: 0, extraMin: 0, intervaloMin: 0, origem: 'ferias', feriadoNome: null, marcacoes: [], ehDiaTrabalho: false, registroOrigem: null });
          } else if (marks.length > 0) {
            const j = calcularJornada(marks, cargaMin);
            const ro = classifyOrigin(marks);
            summaries.push({
              data: ds, totalMin: j.totalTrabalhado, extraMin: ehDia ? j.horaExtraMin : j.totalTrabalhado, intervaloMin: j.totalIntervalo,
              origem: 'real', feriadoNome: null, marcacoes: marks, ehDiaTrabalho: ehDia, registroOrigem: ro,
            });
          } else {
            summaries.push({ data: ds, totalMin: 0, extraMin: 0, intervaloMin: 0, origem: ehDia ? 'pendente' : 'fds', feriadoNome: null, marcacoes: [], ehDiaTrabalho: ehDia, registroOrigem: null });
          }
          cur.setDate(cur.getDate() + 1);
        }

        setDays(summaries);

        const bhSum = summarizeBancoHoras(bh, salario, percentual);
        const totalExtra = summaries.filter(d => d.extraMin > 0 && d.origem !== 'pendente').reduce((s: number, d: any) => s + d.extraMin, 0);
        const totalDevendo = summaries.filter(d => d.devendoMin > 0).reduce((s: number, d: any) => s + (d.devendoMin || 0), 0);
        const saldo = (p?.banco_horas_saldo_inicial ?? 0) + bhSum.saldo - totalComp + totalExtra - totalDevendo;
        setSaldoFinal(saldo);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    carregar();
  }, [user]);

  const alertas = useMemo(() => {
    if (loading || days.length === 0) return [];
    return analisarRadarTrabalhista({
      days,
      bancoSaldoMin: saldoFinal,
      bancoDataPrimeiro: bancoEntries.length > 0 ? bancoEntries.filter(e => e.tipo === 'acumulo').sort((a, b) => a.data.localeCompare(b.data))[0]?.data : null,
      created_at: p.created_at,
      data_admissao: p.data_admissao || p.historico_inicio,
      salario,
      percentualHE: percentual,
      cargaHoras: carga,
      excluirReconstituidos: true,
    });
  }, [days, saldoFinal, bancoEntries, salario, percentual, carga, p, loading]);

  // Cálculos Avançados do Radar
  // Em vez de somar tudo (o que causa contagem dupla, pois o mesmo dia de feriado também gera extra e vai pro banco),
  // pegamos a maior estimativa de prejuízo única (geralmente o Banco de Horas vencido/elevado ou o montante de extras).
  const totalFinanceiro = alertas.length > 0 ? Math.max(...alertas.map(a => a.valorEstimado || 0)) : 0;
  
  // Score de Saúde
  const score = useMemo(() => {
    let pts = 100;
    alertas.forEach(a => {
      if (a.nivel === 'alto') pts -= 20;
      else if (a.nivel === 'medio') pts -= 10;
      else pts -= 5;
    });
    return Math.max(0, pts);
  }, [alertas]);

  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 80 ? 'Excelente' : score >= 50 ? 'Atenção' : 'Risco Crítico';

  // Dados para o Gráfico Radar
  const radarData = useMemo(() => {
    const data = [
      { subject: 'Sobrecarga', A: 100, fullMark: 100 },
      { subject: 'Descanso', A: 100, fullMark: 100 },
      { subject: 'Banco Horas', A: 100, fullMark: 100 },
      { subject: 'Feriados', A: 100, fullMark: 100 },
    ];
    
    alertas.forEach(a => {
      const cat = CATEGORIAS_MAP[a.id]?.nome;
      let penalty = a.nivel === 'alto' ? 40 : a.nivel === 'medio' ? 20 : 10;
      
      const idx = data.findIndex(d => d.subject.includes(cat?.split(' ')[0] || ''));
      if (idx !== -1) {
        data[idx].A = Math.max(0, data[idx].A - penalty);
      }
    });
    return data;
  }, [alertas]);

  const alertasBloqueados = !plano.podeUsarPro ? Math.max(0, alertas.length - 2) : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Premium */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div>
            <p className="text-foreground font-black text-lg leading-none">Radar Trabalhista</p>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-0.5">Auditoria Inteligente</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <ShieldAlert size={20} className="text-white" />
        </div>
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-muted rounded-full" />
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldAlert className="text-indigo-500 animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-bold text-muted-foreground animate-pulse">Auditando sua jornada cruzando com a CLT...</p>
          </div>
        ) : (
          <>
            {/* Painel de Saúde & Dinheiro */}
            <div className="grid grid-cols-2 gap-4">
              {/* Score Circular */}
              <div className="bg-card rounded-3xl border border-border p-5 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-current opacity-[0.03] rounded-full blur-2xl" style={{ color: scoreColor }} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 w-full text-center">Score de Saúde</p>
                <div className="relative w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ value: score }, { value: 100 - score }]}
                        cx="50%" cy="50%"
                        innerRadius={35} outerRadius={45}
                        startAngle={90} endAngle={-270}
                        dataKey="value" stroke="none"
                        cornerRadius={10}
                      >
                        <Cell fill={scoreColor} />
                        <Cell fill="currentColor" className="text-muted/30" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black" style={{ color: scoreColor }}>{score}</span>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}>
                    {scoreLabel}
                  </span>
                </div>
              </div>

              {/* Dinheiro na Mesa */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-5 shadow-lg shadow-emerald-500/20 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                  <DollarSign size={100} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mb-1 opacity-90">Potencial Financeiro</p>
                  <p className="text-xs text-emerald-50/80 leading-snug pr-4">Estimativa de valores atrelados aos riscos identificados</p>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-black tracking-tight">
                    {totalFinanceiro > 0 ? (
                      <>
                        <span className="text-lg opacity-80 mr-0.5">R$</span>
                        {totalFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </>
                    ) : (
                      'R$ 0,00'
                    )}
                  </p>
                  {totalFinanceiro > 0 && (
                    <p className="text-[10px] text-emerald-100 font-medium mt-1">
                      Dinheiro deixado na mesa*
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Gráfico Radar Real */}
            <div className="bg-card rounded-3xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm">Áreas de Risco</h3>
                  <p className="text-[10px] text-muted-foreground">Onde a sua jornada está mais vulnerável</p>
                </div>
                <Activity size={16} className="text-muted-foreground" />
              </div>
              <div className="h-48 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                    <PolarGrid stroke="currentColor" className="text-border" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 600 }} className="text-muted-foreground" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Saúde" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lista de Alertas */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-black text-lg">Achados da Auditoria</h3>
                <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  {alertas.length} ocorrências
                </span>
              </div>

              {alertas.length === 0 ? (
                <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-8 text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-4xl">🏆</span>
                  </div>
                  <p className="font-black text-lg text-emerald-700 dark:text-emerald-300">Jornada Blindada!</p>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
                    Nossa auditoria cruzou seus pontos com a CLT e não encontrou nenhuma inconsistência. Excelente gestão de tempo!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertas.map((a, i) => (
                    <AlertaCard key={a.id} alerta={a} isPro={plano.podeUsarPro} idx={i} />
                  ))}
                  
                  {/* Banner CTA para o PRO se houver alertas bloqueados */}
                  {alertasBloqueados > 0 && (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 shadow-xl text-center">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                      <Lock size={24} className="text-accent mx-auto mb-3" />
                      <p className="text-white font-black text-lg mb-2">Você tem {alertasBloqueados} alertas ocultos</p>
                      <p className="text-slate-300 text-xs mb-5 px-4 leading-relaxed">
                        Desbloqueie o plano PRO para ver o impacto financeiro completo e quais dias exatos a empresa falhou com a CLT.
                      </p>
                      <button onClick={() => navigate('/planos')} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-3.5 rounded-full font-black text-sm shadow-lg shadow-accent/20 transition-transform active:scale-95">
                        Ver Planos e Desbloquear
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Aviso legal */}
            <div className="bg-secondary/50 rounded-3xl p-5 mt-6 border border-border/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 shadow-sm border border-border">
                  <BookOpen size={14} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-foreground uppercase tracking-wider mb-1.5">⚖️ Isenção de Responsabilidade</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed text-justify">
                    {RADAR_ISENCAO_RODAPE} A análise foca em registros reais; pontos automáticos não entram no cálculo de risco. O <strong>Hora Justa</strong> é uma ferramenta analítica pessoal e não substitui consulta a advogado trabalhista.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default RadarPage;
