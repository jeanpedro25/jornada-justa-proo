import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import {
  AlertTriangle, ChevronDown, ChevronUp, Info, TrendingUp,
  Banknote, Calendar, Clock, Shield, AlertCircle, CheckCircle2,
  ArrowLeft, Calculator
} from 'lucide-react';

import {
  mesesFGTSCalendario,
  anosCompletosServico,
  diasAvisoPrevio12606,
  valorAvisoPrevio,
  avosFeriasProporcionais,
  avos13SalarioNoAno,
  valor13Proporcional,
  valorFeriasMaisTerco,
  saldoSalarioMes,
  fgtsEstimado,
  multaFgtsPercentual,
  type TipoRescisao,
} from '@/lib/rescisao-calculo';
import { calcularINSS, calcularIRRFFixaComDependentes } from '@/lib/descontos';

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ItemCalculo {
  label: string;
  valor: number;
  descricao: string;
  positivo: boolean;
  destaque?: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────

const RescisaoPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const p = profile as any;

  const salario = (p?.salario_base as number) ?? 0;
  const dataAdmissaoStr = p?.data_admissao as string | null;
  const dataVencimentoFeriasStr = p?.data_vencimento_ferias as string | null;

  const [tipoRescisao, setTipoRescisao] = useState<TipoRescisao>('sem_justa_causa');
  const [dataDesligamento, setDataDesligamento] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dependentes, setDependentes] = useState(0);
  const [fgtsAcumuladoManual, setFgtsAcumuladoManual] = useState<string>('');
  const [showDetalhe, setShowDetalhe] = useState<string | null>(null);
  const [modoAtivado, setModoAtivado] = useState(false);

  const dataAdmissao = useMemo(() => dataAdmissaoStr ? new Date(dataAdmissaoStr + 'T12:00:00') : null, [dataAdmissaoStr]);
  const dataRef = useMemo(() => new Date(dataDesligamento + 'T12:00:00'), [dataDesligamento]);
  const dataUltimaFerias = useMemo(() => dataVencimentoFeriasStr ? new Date(dataVencimentoFeriasStr + 'T12:00:00') : null, [dataVencimentoFeriasStr]);

  const mesesTrabalhados = useMemo(() => {
    if (!dataAdmissao) return 0;
    return mesesFGTSCalendario(dataAdmissao, dataRef);
  }, [dataAdmissao, dataRef]);

  const anosCompletos = useMemo(
    () => (dataAdmissao ? anosCompletosServico(dataAdmissao, dataRef) : 0),
    [dataAdmissao, dataRef],
  );

  const fgtsEstimadoVal = useMemo(
    () => fgtsEstimado(salario, mesesTrabalhados),
    [salario, mesesTrabalhados],
  );
  const fgtsBase = fgtsAcumuladoManual
    ? parseFloat(String(fgtsAcumuladoManual).replace(',', '.')) || 0
    : fgtsEstimadoVal;

  const diasAvisoPrevio = diasAvisoPrevio12606(anosCompletos);
  const valorAvisoIntegral = valorAvisoPrevio(salario, diasAvisoPrevio, 1);
  const valorAvisoAcordo = valorAvisoPrevio(salario, diasAvisoPrevio, 0.5);

  const inicioPeriodoFerias = dataUltimaFerias ?? dataAdmissao ?? dataRef;
  const avos13 = dataAdmissao && tipoRescisao !== 'justa_causa'
    ? avos13SalarioNoAno(dataAdmissao, dataRef)
    : 0;
  const valor13o = valor13Proporcional(salario, avos13);

  const avosFer = dataAdmissao && tipoRescisao !== 'justa_causa'
    ? avosFeriasProporcionais(inicioPeriodoFerias, dataRef)
    : 0;
  const valorFeriasComTerco = tipoRescisao === 'justa_causa' ? 0 : valorFeriasMaisTerco(salario, avosFer);

  const saldoSalario = saldoSalarioMes(salario, dataRef);
  const diasTrabNoMes = dataRef.getDate();

  const pctMulta = multaFgtsPercentual(tipoRescisao);
  const valorMultaFgts = fgtsBase * pctMulta;

  const itensRescisao = useMemo((): ItemCalculo[] => {
    const items: ItemCalculo[] = [];

    items.push({
      label: 'Saldo de salário',
      valor: saldoSalario,
      descricao: `${diasTrabNoMes} dias trabalhados em ${dataRef.toLocaleDateString('pt-BR', { month: 'long' })} (proporcional ao mês da rescisão)`,
      positivo: true,
    });

    if (tipoRescisao !== 'justa_causa') {
      items.push({
        label: '13º salário proporcional',
        valor: valor13o,
        descricao: `${avos13}/12 avos no ano-calendário ${dataRef.getFullYear()} (art. 7º, VIII, CF)`,
        positivo: true,
      });

      items.push({
        label: 'Férias proporcionais + 1/3',
        valor: valorFeriasComTerco,
        descricao: `${avosFer}/12 avos no período aquisitivo em curso + terço constitucional (1/3)`,
        positivo: true,
      });
    }

    if (tipoRescisao === 'sem_justa_causa') {
      items.push({
        label: `Aviso prévio indenizado (${diasAvisoPrevio} dias)`,
        valor: valorAvisoIntegral,
        descricao: `Lei 12.506/2011: 30 dias + 3 dias por ano completo (máx. 90). Valor = (salário÷30)×dias.`,
        positivo: true,
      });

      items.push({
        label: 'FGTS — Multa rescisória (40%)',
        valor: valorMultaFgts,
        descricao: `40% sobre o saldo FGTS (${formatBRL(fgtsBase)}). Demissão sem justa causa.`,
        positivo: true,
        destaque: true,
      });
    }

    if (tipoRescisao === 'comum_acordo') {
      items.push({
        label: `Aviso prévio (50% — acordo mútuo)`,
        valor: valorAvisoAcordo,
        descricao: `Comum acordo: metade do aviso calculado por Lei 12.506/2011 (${diasAvisoPrevio} dias × 50%).`,
        positivo: true,
      });

      items.push({
        label: 'FGTS — Multa rescisória (20%)',
        valor: valorMultaFgts,
        descricao: `20% sobre o saldo FGTS — rescisão por acordo mútuo.`,
        positivo: true,
        destaque: true,
      });
    }

    let baseTributavel = saldoSalario;
    if (tipoRescisao !== 'justa_causa') {
      baseTributavel += valor13o + valorFeriasComTerco;
    }
    if (tipoRescisao === 'sem_justa_causa') baseTributavel += valorAvisoIntegral;
    if (tipoRescisao === 'comum_acordo') baseTributavel += valorAvisoAcordo;

    const inss = calcularINSS(baseTributavel);
    items.push({
      label: 'Desconto INSS',
      valor: -inss,
      descricao: 'Contribuição previdenciária progressiva sobre a base tributável das verbas (tabelas 2024/2025).',
      positivo: false,
    });

    const irrf = calcularIRRFFixaComDependentes(baseTributavel - inss, dependentes);
    if (irrf > 0) {
      items.push({
        label: 'Desconto IRRF',
        valor: -irrf,
        descricao: `IRRF sobre base após INSS, com dedução por ${dependentes} dependente(s) (tabela 2024/2025).`,
        positivo: false,
      });
    }

    return items;
  }, [
    tipoRescisao,
    saldoSalario,
    valor13o,
    valorFeriasComTerco,
    valorAvisoIntegral,
    valorAvisoAcordo,
    valorMultaFgts,
    avos13,
    avosFer,
    diasAvisoPrevio,
    dependentes,
    fgtsBase,
    dataRef,
    diasTrabNoMes,
  ]);

  const totalBruto = itensRescisao.filter(i => i.valor > 0).reduce((s, i) => s + i.valor, 0);
  const totalDescontos = itensRescisao.filter(i => i.valor < 0).reduce((s, i) => s + i.valor, 0);
  const totalLiquido = totalBruto + totalDescontos;

  const tipoOpts: { value: TipoRescisao; label: string; emoji: string; cor: string; desc: string }[] = [
    { value: 'sem_justa_causa', label: 'Demitido sem justa causa', emoji: '⚡', cor: 'border-orange-400 bg-orange-50 dark:bg-orange-950/30', desc: 'Empresa dispensou sem motivo disciplinar' },
    { value: 'pedido_demissao', label: 'Pedido de demissão', emoji: '🚪', cor: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30', desc: 'Você escolheu sair voluntariamente' },
    { value: 'comum_acordo', label: 'Acordo mútuo', emoji: '🤝', cor: 'border-purple-400 bg-purple-50 dark:bg-purple-950/30', desc: 'Empresa e funcionário concordaram em encerrar' },
    { value: 'justa_causa', label: 'Demitido por justa causa', emoji: '❌', cor: 'border-rose-400 bg-rose-50 dark:bg-rose-950/30', desc: 'Por falta grave disciplinar' },
  ];

  if (!modoAtivado) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader title="Rescisão & FGTS" subtitle="Simulador trabalhista" />

        <div className="px-4 pt-4 pb-6 max-w-lg mx-auto space-y-5">

          {/* FGTS Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 shadow-xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />

            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">📦 FGTS Estimado</p>
            <p className="text-white text-3xl font-black tracking-tight">{formatBRL(fgtsEstimadoVal)}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="bg-white/15 rounded-xl p-2.5 text-center">
                <p className="text-white/60 text-[9px] uppercase font-medium">Meses</p>
                <p className="text-white font-bold text-lg">{mesesTrabalhados}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-2.5 text-center">
                <p className="text-white/60 text-[9px] uppercase font-medium">Por mês</p>
                <p className="text-white font-bold text-base">{formatBRL(salario * 0.08)}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-2.5 text-center">
                <p className="text-white/60 text-[9px] uppercase font-medium">Taxa</p>
                <p className="text-white font-bold text-lg">8%</p>
              </div>
            </div>

            {!dataAdmissaoStr && (
              <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                <AlertCircle size={13} className="text-yellow-300 shrink-0" />
                <p className="text-white/80 text-[11px]">Configure a data de admissão nas <span className="underline font-semibold">Configurações</span> para cálculo preciso.</p>
              </div>
            )}
          </div>

          {/* Info boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-accent" />
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Admissão</p>
              </div>
              <p className="text-sm font-bold">{dataAdmissao ? dataAdmissao.toLocaleDateString('pt-BR') : '—'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{anosCompletos} anos completos (aviso) · {mesesTrabalhados} meses (FGTS)</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-emerald-500" />
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Multa 40%</p>
              </div>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(fgtsEstimadoVal * 0.4)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">se demitido sem causa</p>
            </div>
          </div>

          {/* Aviso prévio info */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-blue-500" />
              <p className="text-sm font-semibold">Aviso Prévio</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{diasAvisoPrevio} dias</p>
                <p className="text-xs text-muted-foreground mt-0.5">30 base + {anosCompletos} anos × 3 dias</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatBRL(valorAvisoIntegral)}</p>
                <p className="text-[10px] text-muted-foreground">valor indenizado</p>
              </div>
            </div>
          </div>

          {/* Activate mode */}
          <div className="rounded-3xl overflow-hidden border-2 border-dashed border-rose-300 dark:border-rose-700">
            <div className="bg-rose-50 dark:bg-rose-950/30 px-5 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                  <Calculator size={18} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Modo Desligamento</p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400/80">Calcule sua rescisão completa</p>
                </div>
              </div>
              <p className="text-xs text-rose-700/70 dark:text-rose-300/70">
                Simule o valor exato que você receberá em cada tipo de desligamento — demissão sem justa causa, pedido de demissão, acordo mútuo ou justa causa.
              </p>
              <button
                onClick={() => setModoAtivado(true)}
                className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 text-sm shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-rose-700 transition-all active:scale-[0.98]"
              >
                🔴 Ativar modo desligamento
              </button>
            </div>
          </div>

          {/* CLT info */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">📖 Seus direitos (CLT)</p>
            {[
              { icon: '💼', label: 'FGTS', desc: '8% do salário bruto por mês, depositado pelo empregador' },
              { icon: '🎯', label: '13º Salário', desc: '1 salário ao ano, proporcional aos meses trabalhados' },
              { icon: '🏖', label: 'Férias', desc: '30 dias por período de 12 meses + 1/3 constitucional' },
              { icon: '📅', label: 'Aviso Prévio', desc: '30 dias + 3 dias por ano de serviço (máx 90 dias)' },
            ].map(i => (
              <div key={i.label} className="flex items-start gap-2.5">
                <span className="text-base">{i.icon}</span>
                <div>
                  <p className="text-xs font-semibold">{i.label}</p>
                  <p className="text-[10px] text-muted-foreground">{i.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center px-2">
            ⚠️ Valores estimados com base nas informações configuradas. Para validação oficial, consulte um advogado trabalhista ou o setor de RH.
          </p>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ── MODO DESLIGAMENTO ATIVO ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-rose-600 dark:bg-rose-700 px-4 py-4 flex items-center gap-3">
        <button onClick={() => setModoAtivado(false)} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <ArrowLeft size={16} className="text-white" />
        </button>
        <div>
          <p className="text-white/70 text-[10px] uppercase font-semibold tracking-wider">Modo Desligamento</p>
          <p className="text-white font-bold text-base">Simulação de Rescisão</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto space-y-5">

        {/* Tipo de rescisão */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Tipo de desligamento</p>
          <div className="grid grid-cols-2 gap-2">
            {tipoOpts.map(o => (
              <button key={o.value} onClick={() => setTipoRescisao(o.value)}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${tipoRescisao === o.value ? o.cor + ' shadow-sm' : 'bg-card border-border'}`}>
                <span className="text-lg">{o.emoji}</span>
                <p className="text-xs font-bold mt-1 leading-tight">{o.label}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{o.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Data desligamento */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Data do desligamento</p>
          <input type="date" value={dataDesligamento} onChange={e => setDataDesligamento(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>

        {/* FGTS acumulado real (opcional) */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Saldo FGTS real (opcional)</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
            <input type="number" inputMode="decimal" value={fgtsAcumuladoManual} onChange={e => setFgtsAcumuladoManual(e.target.value)}
              placeholder={`Estimado: ${fgtsEstimadoVal.toFixed(2)}`}
              className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 px-1">Consulte o app do FGTS (Caixa Econômica) para o saldo exato.</p>
        </div>

        {/* Dependentes */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Dependentes (IRRF)</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => setDependentes(n)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${dependentes === n ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-secondary text-secondary-foreground'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Resultado */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-4">
            <p className="text-white/70 text-[10px] uppercase font-semibold tracking-wider">Total a receber</p>
            <p className="text-white text-3xl font-black mt-0.5">{formatBRL(totalLiquido)}</p>
            <p className="text-white/60 text-xs mt-1">líquido estimado • {tipoOpts.find(t => t.value === tipoRescisao)?.label}</p>
          </div>

          <div className="p-4 space-y-1">
            {itensRescisao.map((item, i) => (
              <div key={i}>
                <button className="w-full flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded-lg px-1 transition-colors"
                  onClick={() => setShowDetalhe(showDetalhe === item.label ? null : item.label)}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${item.positivo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.destaque && <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">FGTS</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${item.positivo ? 'text-foreground' : 'text-rose-500'}`}>
                      {item.valor < 0 ? '-' : '+'}{formatBRL(Math.abs(item.valor))}
                    </span>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showDetalhe === item.label ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {showDetalhe === item.label && (
                  <div className="mx-3 mb-2 bg-muted/40 rounded-xl px-3 py-2">
                    <p className="text-xs text-muted-foreground">{item.descricao}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-muted/30 px-5 py-3 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total bruto</span>
              <span className="font-semibold">{formatBRL(totalBruto)}</span>
            </div>
            <div className="flex justify-between text-sm mt-0.5">
              <span className="text-muted-foreground">Descontos</span>
              <span className="font-semibold text-rose-500">{formatBRL(totalDescontos)}</span>
            </div>
            <div className="flex justify-between text-base mt-2 pt-2 border-t border-border font-black">
              <span>Líquido estimado</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatBRL(totalLiquido)}</span>
            </div>
          </div>
        </div>

        {/* FGTS acumulado */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={16} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Saldo FGTS → saque liberado</p>
          </div>
          <p className="text-emerald-800 dark:text-emerald-200 text-2xl font-black">{formatBRL(fgtsBase)}</p>
          <p className="text-emerald-600/70 dark:text-emerald-400/70 text-xs mt-1">
            {tipoRescisao === 'justa_causa' && '❌ Justa causa: FGTS não é sacável nesta modalidade.'}
            {tipoRescisao === 'pedido_demissao' && '❌ Pedido de demissão: FGTS não é sacável (sem multa).'}
            {tipoRescisao === 'sem_justa_causa' && '✅ Você pode sacar o FGTS + 40% de multa ao ser dispensado sem justa causa.'}
            {tipoRescisao === 'comum_acordo' && '✅ No acordo mútuo você pode sacar 80% do FGTS acumulado.'}
          </p>
        </div>

        {/* Alerta informativo */}
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Aviso legal:</strong> Esta simulação é uma estimativa baseada nos dados configurados. Valores reais dependem de acordos coletivos, benefícios e outros fatores. Consulte sempre o RH ou um advogado trabalhista.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default RescisaoPage;
