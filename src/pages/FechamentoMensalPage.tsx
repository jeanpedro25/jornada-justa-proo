import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import {
  calcularJornada, formatarDuracaoJornada, getCargaDiaria,
  isScheduledWorkday, type Marcacao,
} from '@/lib/jornada';
import { getFeriadoComLocais } from '@/lib/feriados';
import {
  CheckCircle2, XCircle, Clock, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, Banknote, BarChart3, Info,
} from 'lucide-react';

// ── Storage helpers (localStorage keyed by userId) ──────────────────────────

interface FechamentoRecord {
  mes: string;          // "2024-03"
  extraMin: number;     // total extra minutes that month
  totalMin: number;     // total worked minutes
  diasTrab: number;
  valorEstimado: number; // R$
  status: 'pendente' | 'pago' | 'nao_pago';
  confirmedAt?: string;
  observacao?: string;
}

function storageKey(userId: string) {
  return `hora_justa_fechamentos_${userId}`;
}

function loadFechamentos(userId: string): FechamentoRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFechamentos(userId: string, records: FechamentoRecord[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getMesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMesesDesdeInicio(desde: string): string[] {
  const meses: string[] = [];
  const start = new Date(desde + '-01T12:00:00');
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    meses.push(key);
    cur.setMonth(cur.getMonth() + 1);
  }
  return meses.reverse(); // most recent first
}

// ── Main Component ────────────────────────────────────────────────────────────

const FechamentoMensalPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const p = profile as any;

  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;
  const carga = getCargaDiaria(
    p.tipo_jornada || 'jornada_fixa',
    p.escala_tipo || null,
    p.carga_horaria_diaria ?? 8,
    p
  );
  const valorHE = salario > 0 ? (salario / 220) * (1 + percentual / 100) : 0;

  const [fechamentos, setFechamentos] = useState<FechamentoRecord[]>([]);
  const [calculados, setCalculados] = useState<Map<string, { extraMin: number; totalMin: number; diasTrab: number }>>(new Map());
  const [expandedMes, setExpandedMes] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [obsText, setObsText] = useState('');
  const [feriadosLocais, setFeriadosLocais] = useState<{ data: string; nome: string; recorrente: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  const admissao = (p?.data_admissao || p?.historico_inicio || p?.created_at?.split('T')[0]) ?? getMesAtual().slice(0, 7) + '-01';
  const desde = admissao.slice(0, 7);

  const meses = useMemo(() => getMesesDesdeInicio(desde), [desde]);
  const mesAtual = getMesAtual();

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load all marcacoes
    const { data: marcData } = await supabase
      .from('marcacoes_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .neq('origem', 'importacao_automatica')
      .order('horario', { ascending: true }) as any;

    const { data: ferData } = await supabase
      .from('feriados_locais')
      .select('data, nome, recorrente')
      .eq('user_id', user.id) as any;

    setFeriadosLocais(ferData || []);

    // Calculate per month
    const marcacoes: Marcacao[] = marcData || [];
    const byMonth = new Map<string, Marcacao[]>();
    marcacoes.forEach(m => {
      const mes = m.data.slice(0, 7);
      if (!byMonth.has(mes)) byMonth.set(mes, []);
      byMonth.get(mes)!.push(m);
    });

    const result = new Map<string, { extraMin: number; totalMin: number; diasTrab: number }>();
    byMonth.forEach((marks, mes) => {
      const byDay = new Map<string, Marcacao[]>();
      marks.forEach(m => {
        if (!byDay.has(m.data)) byDay.set(m.data, []);
        byDay.get(m.data)!.push(m);
      });

      let extraMin = 0, totalMin = 0, diasTrab = 0;
      byDay.forEach((dayMarks, data) => {
        const feriado = getFeriadoComLocais(data, ferData || []);
        const ehFds = !isScheduledWorkday(data, p);
        const cargaDia = (feriado || ehFds) ? 0 : carga * 60;
        const j = calcularJornada(dayMarks, cargaDia);
        extraMin += j.horaExtraMin;
        totalMin += j.totalTrabalhado;
        diasTrab++;
      });
      result.set(mes, { extraMin, totalMin, diasTrab });
    });
    setCalculados(result);

    // Load saved confirmations
    const saved = loadFechamentos(user.id);
    setFechamentos(saved);
    setLoading(false);
  }, [user, carga, p]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const confirmar = (mes: string, status: 'pago' | 'nao_pago') => {
    if (!user) return;
    const calc = calculados.get(mes) ?? { extraMin: 0, totalMin: 0, diasTrab: 0 };
    const valor = (calc.extraMin / 60) * valorHE;

    const updated = fechamentos.filter(f => f.mes !== mes);
    updated.push({
      mes,
      extraMin: calc.extraMin,
      totalMin: calc.totalMin,
      diasTrab: calc.diasTrab,
      valorEstimado: valor,
      status,
      confirmedAt: new Date().toISOString(),
      observacao: obsText.trim() || undefined,
    });
    saveFechamentos(user.id, updated);
    setFechamentos(updated);
    setConfirming(null);
    setObsText('');
  };

  const desfazer = (mes: string) => {
    if (!user) return;
    const updated = fechamentos.filter(f => f.mes !== mes);
    saveFechamentos(user.id, updated);
    setFechamentos(updated);
  };

  // ── Computed totals ───────────────────────────────────────────────────────

  const totalNaoPagoMin = useMemo(() => {
    return fechamentos
      .filter(f => f.status === 'nao_pago')
      .reduce((s, f) => s + f.extraMin, 0);
  }, [fechamentos]);

  const totalPagoMin = useMemo(() => {
    return fechamentos
      .filter(f => f.status === 'pago')
      .reduce((s, f) => s + f.extraMin, 0);
  }, [fechamentos]);

  const totalNaoPagoValor = (totalNaoPagoMin / 60) * valorHE;
  const totalPagoValor = (totalPagoMin / 60) * valorHE;

  const mesesPendentes = useMemo(() => {
    return meses.filter(m => {
      if (m === mesAtual) return false;
      const calc = calculados.get(m);
      if (!calc || calc.extraMin === 0) return false;
      return !fechamentos.find(f => f.mes === m);
    });
  }, [meses, calculados, fechamentos, mesAtual]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Calculando fechamentos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Fechamento Mensal" subtitle="Controle de horas extras por mês" />

      <div className="px-4 pt-4 pb-2 max-w-lg mx-auto space-y-4">

        {/* Hero summary */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-10 -translate-x-8" />

          <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-3">📊 Resumo geral</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-2xl p-3">
              <p className="text-white/60 text-[9px] uppercase font-medium">🚫 Não pago</p>
              <p className="text-white text-xl font-black mt-0.5">{formatarDuracaoJornada(totalNaoPagoMin)}</p>
              {totalNaoPagoValor > 0 && salario > 0 && (
                <p className="text-rose-200 text-xs font-semibold mt-0.5">{formatBRL(totalNaoPagoValor)}</p>
              )}
              <p className="text-white/50 text-[9px] mt-1">acumulado sem receber</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3">
              <p className="text-white/60 text-[9px] uppercase font-medium">✅ Pago</p>
              <p className="text-white text-xl font-black mt-0.5">{formatarDuracaoJornada(totalPagoMin)}</p>
              {totalPagoValor > 0 && salario > 0 && (
                <p className="text-emerald-200 text-xs font-semibold mt-0.5">{formatBRL(totalPagoValor)}</p>
              )}
              <p className="text-white/50 text-[9px] mt-1">já recebido no total</p>
            </div>
          </div>

          {mesesPendentes.length > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
              <AlertTriangle size={12} className="text-yellow-300 shrink-0" />
              <p className="text-white/80 text-[11px]">
                {mesesPendentes.length} mês(es) com extras aguardando confirmação de pagamento.
              </p>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Ao fechar cada mês, confirme se sua empresa pagou as horas extras. Se <strong>não pagou</strong>, o saldo acumula aqui como prova de débito. Use no relatório ou em uma eventual ação trabalhista.
          </p>
        </div>

        {/* Months list */}
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Histórico mensal</p>

        <div className="space-y-2">
          {meses.map(mes => {
            const isCurrent = mes === mesAtual;
            const calc = calculados.get(mes) ?? { extraMin: 0, totalMin: 0, diasTrab: 0 };
            const fechamento = fechamentos.find(f => f.mes === mes);
            const valorExtra = (calc.extraMin / 60) * valorHE;
            const isExpanded = expandedMes === mes;
            const isConfirming = confirming === mes;

            const statusColor = () => {
              if (isCurrent) return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800';
              if (!fechamento && calc.extraMin > 0) return 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800';
              if (fechamento?.status === 'nao_pago') return 'border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800';
              if (fechamento?.status === 'pago') return 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800';
              return 'border-border bg-card';
            };

            return (
              <div key={mes} className={`rounded-2xl border transition-all ${statusColor()}`}>
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedMes(isExpanded ? null : mes)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold capitalize">{mesLabel(mes)}</p>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Mês atual
                          </span>
                        )}
                        {fechamento?.status === 'pago' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 size={9} /> Pago
                          </span>
                        )}
                        {fechamento?.status === 'nao_pago' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 flex items-center gap-1">
                            <XCircle size={9} /> Não pago
                          </span>
                        )}
                        {!fechamento && !isCurrent && calc.extraMin > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            ⏳ Aguardando
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {formatarDuracaoJornada(calc.totalMin)}
                        </span>
                        {calc.extraMin > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <TrendingUp size={10} /> +{formatarDuracaoJornada(calc.extraMin)} extras
                          </span>
                        )}
                        {calc.extraMin === 0 && !isCurrent && (
                          <span className="text-muted-foreground/60">Sem horas extras</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {calc.extraMin > 0 && salario > 0 && (
                        <p className={`text-sm font-black tabular-nums ${
                          fechamento?.status === 'nao_pago' ? 'text-rose-600 dark:text-rose-400' :
                          fechamento?.status === 'pago' ? 'text-emerald-600 dark:text-emerald-400' :
                          'text-amber-600 dark:text-amber-400'
                        }`}>
                          {formatBRL(valorExtra)}
                        </p>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-card rounded-xl p-2.5 border border-border">
                        <p className="text-[9px] text-muted-foreground uppercase">Trabalhado</p>
                        <p className="text-xs font-bold">{formatarDuracaoJornada(calc.totalMin)}</p>
                      </div>
                      <div className="bg-card rounded-xl p-2.5 border border-border">
                        <p className="text-[9px] text-muted-foreground uppercase">Extras</p>
                        <p className={`text-xs font-bold ${calc.extraMin > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {calc.extraMin > 0 ? `+${formatarDuracaoJornada(calc.extraMin)}` : '—'}
                        </p>
                      </div>
                      <div className="bg-card rounded-xl p-2.5 border border-border">
                        <p className="text-[9px] text-muted-foreground uppercase">Dias</p>
                        <p className="text-xs font-bold">{calc.diasTrab}</p>
                      </div>
                    </div>

                    {salario > 0 && calc.extraMin > 0 && (
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Valor estimado das extras</p>
                          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">{percentual}% adicional · {formatarDuracaoJornada(calc.extraMin)}</p>
                        </div>
                        <p className="text-base font-black text-amber-600">{formatBRL(valorExtra)}</p>
                      </div>
                    )}

                    {/* Confirmation block */}
                    {!isCurrent && calc.extraMin > 0 && (
                      <>
                        {fechamento ? (
                          <div className="space-y-2">
                            <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${
                              fechamento.status === 'pago'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800'
                            }`}>
                              {fechamento.status === 'pago'
                                ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                : <XCircle size={14} className="text-rose-600 shrink-0" />
                              }
                              <div className="flex-1">
                                <p className={`text-xs font-semibold ${fechamento.status === 'pago' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                  {fechamento.status === 'pago' ? 'Extras recebidas neste mês ✅' : 'Extras NÃO recebidas — débito registrado ❌'}
                                </p>
                                {fechamento.observacao && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">"{fechamento.observacao}"</p>
                                )}
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  Confirmado em {new Date(fechamento.confirmedAt!).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => desfazer(mes)}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline w-full text-center"
                            >
                              Desfazer confirmação
                            </button>
                          </div>
                        ) : isConfirming ? (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-center">Sua empresa pagou as horas extras de {mesLabel(mes).split(' ')[0]}?</p>
                            <input
                              type="text"
                              placeholder="Observação opcional (ex: constou no holerite)"
                              value={obsText}
                              onChange={e => setObsText(e.target.value)}
                              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => confirmar(mes, 'pago')}
                                className="rounded-xl py-2.5 text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 size={13} /> Sim, recebi!
                              </button>
                              <button
                                onClick={() => confirmar(mes, 'nao_pago')}
                                className="rounded-xl py-2.5 text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <XCircle size={13} /> Não recebi
                              </button>
                            </div>
                            <button onClick={() => setConfirming(null)} className="text-[10px] text-muted-foreground hover:text-foreground underline w-full text-center">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setConfirming(mes); setExpandedMes(mes); }}
                            className="w-full rounded-xl py-2.5 text-xs font-bold border border-dashed border-accent text-accent hover:bg-accent/10 transition-colors flex items-center justify-center gap-2"
                          >
                            <Banknote size={14} /> Confirmar pagamento deste mês
                          </button>
                        )}
                      </>
                    )}

                    {isCurrent && (
                      <p className="text-[10px] text-muted-foreground text-center italic">Mês em andamento — confirme ao fechar o mês.</p>
                    )}

                    {!isCurrent && calc.extraMin === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center">Nenhuma hora extra neste mês — nada a confirmar.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Acumulado não pago */}
        {totalNaoPagoMin > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/20 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                <BarChart3 size={18} className="text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Saldo acumulado não pago</p>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70">débito da empresa com você</p>
              </div>
            </div>
            <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{formatarDuracaoJornada(totalNaoPagoMin)}</p>
            {salario > 0 && (
              <p className="text-rose-500 font-bold mt-0.5">{formatBRL(totalNaoPagoValor)}</p>
            )}
            <p className="text-[10px] text-rose-500/70 dark:text-rose-400/60 mt-2">
              Baseado nos meses marcados como "Não recebi". Use o Relatório PDF como documento de controle.
            </p>
            <button
              onClick={() => navigate('/relatorio')}
              className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
            >
              📄 Gerar relatório como prova →
            </button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/50 text-center px-2 pb-2">
          ⚠️ Registros armazenados localmente neste dispositivo. Valores são estimativas calculadas pelo sistema.
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default FechamentoMensalPage;
