import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Zap, Play, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { gerarHistoricoMultiPeriodo, contarDiasUteis, type PeriodoTrabalho } from '@/lib/historico-automatico';
import { dataHojeLocal } from '@/lib/dataHora';

const TOTAL_STEPS = 7; // 1-nome, 2-salário, 3-carga, 4-extras, 5-histórico escolha, 6-config importação, 7-processando

const OnboardingPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [salario, setSalario] = useState('');
  const [carga, setCarga] = useState<number | null>(null);
  const [cargaCustom, setCargaCustom] = useState('');
  const [percentual, setPercentual] = useState('50');
  const [percentualFeriado, setPercentualFeriado] = useState('100');
  const [loading, setLoading] = useState(false);

  // Step 5 - history choice
  const [escolhaHistorico, setEscolhaHistorico] = useState<'zero' | 'importar' | null>(null);

  // Step 6 - import config with multiple periods
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [admDia, setAdmDia] = useState('');
  const [admMes, setAdmMes] = useState('');
  const [admAno, setAdmAno] = useState('');

  // Multiple work periods
  interface PeriodoUI {
    id: number;
    entradaHora: string;
    saidaHora: string;
    intervaloMin: string;
    diasSemana: number[];
    dataInicio: string; // YYYY-MM-DD — auto-calculated from sequence
    dataFim: string;    // YYYY-MM-DD — auto-calculated
    dataFimDia: string;
    dataFimMes: string;
    dataFimAno: string;
  }

  const [periodos, setPeriodos] = useState<PeriodoUI[]>([
    {
      id: 1,
      entradaHora: '08:00',
      saidaHora: '17:00',
      intervaloMin: '60',
      diasSemana: [1, 2, 3, 4, 5],
      dataInicio: '',
      dataFim: '',
      dataFimDia: '',
      dataFimMes: '',
      dataFimAno: '',
    },
  ]);

  const [sabeSaldo, setSabeSaldo] = useState(false);
  const [saldoHoras, setSaldoHoras] = useState('0');
  const [saldoMinutos, setSaldoMinutos] = useState('0');

  // Step 7 - processing
  const [progresso, setProgresso] = useState(0);
  const [progressoMsg, setProgressoMsg] = useState('');
  const [processando, setProcessando] = useState(false);

  const hoje = dataHojeLocal();

  // Sync separate fields → dataAdmissao
  const updateDataAdmissao = (dia: string, mes: string, ano: string) => {
    setAdmDia(dia);
    setAdmMes(mes);
    setAdmAno(ano);
    if (dia.length === 2 && mes.length === 2 && ano.length === 4) {
      const d = parseInt(dia), m = parseInt(mes), a = parseInt(ano);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && a >= 1900 && a <= 2100) {
        setDataAdmissao(`${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`);
      } else {
        setDataAdmissao('');
      }
    } else {
      setDataAdmissao('');
    }
  };

  const diasUteisEstimados = useMemo(() => {
    if (!dataAdmissao || dataAdmissao >= hoje) return 0;
    return contarDiasUteis(dataAdmissao, hoje, periodos[0].diasSemana);
  }, [dataAdmissao, hoje, periodos]);

  const mesesHistorico = useMemo(() => {
    if (!dataAdmissao) return 0;
    const d1 = new Date(dataAdmissao);
    const d2 = new Date(hoje);
    return Math.max(0, (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth());
  }, [dataAdmissao, hoje]);

  const maxStep = escolhaHistorico === 'importar' ? 7 : 5;
  const progressValue = (Math.min(step, maxStep) / maxStep) * 100;

  const toggleDia = (periodoId: number, dia: number) => {
    setPeriodos(prev => prev.map(p => {
      if (p.id !== periodoId) return p;
      const newDias = p.diasSemana.includes(dia)
        ? p.diasSemana.filter(d => d !== dia)
        : [...p.diasSemana, dia].sort();
      return { ...p, diasSemana: newDias };
    }));
  };

  const updatePeriodo = (id: number, field: string, value: any) => {
    setPeriodos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updatePeriodoDataFim = (id: number, dia: string, mes: string, ano: string) => {
    setPeriodos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, dataFimDia: dia, dataFimMes: mes, dataFimAno: ano };
      if (dia.length === 2 && mes.length === 2 && ano.length === 4) {
        const d = parseInt(dia), m = parseInt(mes), a = parseInt(ano);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && a >= 1900 && a <= 2100) {
          updated.dataFim = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        } else {
          updated.dataFim = '';
        }
      } else {
        updated.dataFim = '';
      }
      return updated;
    }));
  };

  const addPeriodo = () => {
    const lastPeriodo = periodos[periodos.length - 1];
    setPeriodos(prev => [...prev, {
      id: Date.now(),
      entradaHora: lastPeriodo.entradaHora,
      saidaHora: lastPeriodo.saidaHora,
      intervaloMin: lastPeriodo.intervaloMin,
      diasSemana: [...lastPeriodo.diasSemana],
      dataInicio: '',
      dataFim: '',
      dataFimDia: '',
      dataFimMes: '',
      dataFimAno: '',
    }]);
  };

  const removePeriodo = (id: number) => {
    if (periodos.length <= 1) return;
    setPeriodos(prev => prev.filter(p => p.id !== id));
  };

  const canAdvance = (): boolean => {
    if (step === 1) return nome.trim().length > 0;
    if (step === 2) return salario.trim().length > 0 && Number(salario) > 0;
    if (step === 3) return carga !== null || (cargaCustom.trim().length > 0 && Number(cargaCustom) > 0);
    if (step === 4) return Number(percentual) > 0 && Number(percentualFeriado) > 0;
    if (step === 5) return escolhaHistorico !== null;
    if (step === 6) {
      if (!dataAdmissao || dataAdmissao >= hoje) return false;
      // If multiple periods, each needs a dataFim (except the last which goes to today)
      if (periodos.length > 1) {
        for (let i = 0; i < periodos.length - 1; i++) {
          if (!periodos[i].dataFim) return false;
        }
      }
      return periodos.every(p => p.diasSemana.length > 0);
    }
    return false;
  };

  const saveProfile = async (
    extra: Record<string, any> = {},
    options: { completeOnboarding?: boolean } = {}
  ) => {
    if (!user) return false;
    const { completeOnboarding = true } = options;
    const cargaFinal = carga || Number(cargaCustom);
    const payload = {
      id: user.id,
      nome: nome.trim(),
      salario_base: Number(salario),
      carga_horaria_diaria: cargaFinal,
      hora_extra_percentual: Number(percentual),
      hora_extra_percentual_feriado: Number(percentualFeriado),
      ...extra,
      ...(completeOnboarding ? { onboarding_completo: true } : {}),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload as any, { onConflict: 'id' });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleFinishWithoutHistory = async () => {
    setLoading(true);
    const ok = await saveProfile();
    if (ok) {
      await refreshProfile();
      toast({ title: 'Tudo certo!', description: 'Seu perfil foi configurado.' });
      navigate('/app');
    }
    setLoading(false);
  };

  const buildPeriodos = (): PeriodoTrabalho[] => {
    const result: PeriodoTrabalho[] = [];
    for (let i = 0; i < periodos.length; i++) {
      const p = periodos[i];
      const inicio = i === 0 ? dataAdmissao : (periodos[i - 1].dataFim || dataAdmissao);
      const fim = i === periodos.length - 1 ? hoje : (p.dataFim || hoje);
      result.push({
        dataInicio: inicio,
        dataFim: fim,
        entradaHora: p.entradaHora,
        saidaHora: p.saidaHora,
        intervaloMin: Number(p.intervaloMin),
        diasSemana: p.diasSemana,
      });
    }
    return result;
  };

  const handleStartImport = async () => {
    if (!user) return;
    setStep(7);
    setProcessando(true);
    setProgresso(0);

    try {
      const ok = await saveProfile(
        { data_admissao: dataAdmissao, onboarding_completo: false },
        { completeOnboarding: false }
      );
      if (!ok) {
        setProcessando(false);
        setStep(6);
        return;
      }

      const saldoTotal = (Number(saldoHoras) * 60) + Number(saldoMinutos);
      const periodosConfig = buildPeriodos();

      const result = await gerarHistoricoMultiPeriodo(
        user.id,
        periodosConfig,
        sabeSaldo ? saldoTotal : 0,
        (pct, msg) => {
          setProgresso(pct);
          setProgressoMsg(msg);
        }
      );

      setProgresso(100);
      setProgressoMsg(`${result.totalDias} dias criados!`);

      const finalized = await saveProfile({ data_admissao: dataAdmissao });
      if (!finalized) {
        throw new Error('Não foi possível concluir seu onboarding.');
      }

      await refreshProfile();
      toast({
        title: '⚡ Histórico gerado!',
        description: `${result.totalDias} dias de trabalho reconstituídos.`,
      });

      setTimeout(() => navigate('/app'), 1500);
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
      setProcessando(false);
      setStep(6);
    }
  };

  const next = () => {
    if (step === 4) {
      setStep(5); // go to history choice
    } else if (step === 5) {
      if (escolhaHistorico === 'zero') {
        handleFinishWithoutHistory();
      } else {
        setStep(6);
      }
    } else if (step === 6) {
      handleStartImport();
    } else if (step < 5) {
      setStep(step + 1);
    }
  };

  // Ordem: Seg(1) a Dom(0) — padrão brasileiro
  const diasOrdenados = [
    { label: 'Seg', idx: 1 },
    { label: 'Ter', idx: 2 },
    { label: 'Qua', idx: 3 },
    { label: 'Qui', idx: 4 },
    { label: 'Sex', idx: 5 },
    { label: 'Sáb', idx: 6 },
    { label: 'Dom', idx: 0 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary px-4 py-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-primary-foreground text-lg font-bold">Configurar perfil</h1>
          <p className="text-primary-foreground/60 text-sm">
            {step <= maxStep ? `Passo ${step} de ${maxStep}` : 'Finalizando...'}
          </p>
          <Progress value={progressValue} className="mt-3 h-2" />
        </div>
      </div>

      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {/* Step 1 - Nome */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Como você quer ser chamado?</h2>
            <Input
              placeholder="Seu nome ou apelido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-xl h-12 text-base"
              autoFocus
            />
          </div>
        )}

        {/* Step 2 - Salário */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Qual é o seu salário mensal?</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
              <Input
                type="number"
                placeholder="0,00"
                value={salario}
                onChange={(e) => setSalario(e.target.value)}
                className="rounded-xl h-12 text-base pl-10"
                min={0}
                step="0.01"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 3 - Carga horária */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Quantas horas você trabalha por dia?</h2>
            <div className="grid grid-cols-3 gap-3">
              {[6, 7, '7h30', 8, '8h30', 9, 10, 12].map((h) => {
                const valor = typeof h === 'string' ? parseFloat(h.replace('h', '.').replace('30', '5')) : h;
                const label = typeof h === 'string' ? h : `${h}h`;
                return (
                  <button
                    key={label}
                    onClick={() => { setCarga(valor); setCargaCustom(''); }}
                    className={`py-3 rounded-xl border-2 font-semibold transition-colors ${
                      carga === valor && !cargaCustom
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => { setCarga(null); setCargaCustom(''); }}
                className={`py-3 rounded-xl border-2 font-semibold transition-colors ${
                  carga === null || cargaCustom
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-foreground'
                }`}
              >
                Outro
              </button>
            </div>
            {(carga === null || cargaCustom) && (
              <Input
                type="number"
                placeholder="Ex: 8.5"
                value={cargaCustom}
                onChange={(e) => { setCargaCustom(e.target.value); setCarga(null); }}
                className="rounded-xl h-12 text-base"
                min={1}
                max={24}
                step="0.5"
                autoFocus
              />
            )}
          </div>
        )}

        {/* Step 4 - Hora extra */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Qual é o seu adicional de hora extra?</h2>
            <p className="text-xs text-muted-foreground">
              Estes são os valores padrão da CLT. Verifique se o seu sindicato possui porcentagens maiores.
            </p>
            <div className="space-y-3">
              <div className="w-full py-4 rounded-xl border-2 border-border px-4">
                <label className="text-sm text-muted-foreground">Dias úteis (%)</label>
                <Input
                  type="number"
                  value={percentual}
                  onChange={(e) => setPercentual(e.target.value)}
                  className="rounded-xl h-12 text-base mt-1"
                  min={1}
                  max={200}
                />
              </div>
              <div className="w-full py-4 rounded-xl border-2 border-border px-4">
                <label className="text-sm text-muted-foreground">Domingos/Feriados (%)</label>
                <Input
                  type="number"
                  value={percentualFeriado}
                  onChange={(e) => setPercentualFeriado(e.target.value)}
                  className="rounded-xl h-12 text-base mt-1"
                  min={1}
                  max={200}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5 - Escolha do histórico */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">📅 O que fazer com o período anterior?</h2>
            <p className="text-sm text-muted-foreground">
              Escolha como deseja iniciar o controle da sua jornada.
            </p>

            <button
              onClick={() => setEscolhaHistorico('zero')}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                escolhaHistorico === 'zero'
                  ? 'border-accent bg-accent/10'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <Play className="w-5 h-5 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="font-semibold">Começar do zero — só de hoje em diante</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Histórico começa hoje. Período anterior não aparece.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setEscolhaHistorico('importar')}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                escolhaHistorico === 'importar'
                  ? 'border-accent bg-accent/10'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="font-semibold">⚡ Preencher histórico automático</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O sistema vai criar os registros dos seus dias de trabalho com base no seu horário cadastrado. Você pode corrigir depois.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 6 - Configurar importação */}
        {step === 6 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">⚡ Configurar histórico automático</h2>

            {/* Período */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de admissão</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Dia</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="DD"
                    value={admDia}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                      updateDataAdmissao(v, admMes, admAno);
                    }}
                    className="rounded-xl h-12 text-base text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Mês</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    value={admMes}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                      updateDataAdmissao(admDia, v, admAno);
                    }}
                    className="rounded-xl h-12 text-base text-center"
                  />
                </div>
                <div className="flex-[1.5]">
                  <label className="text-xs text-muted-foreground">Ano</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="AAAA"
                    value={admAno}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      updateDataAdmissao(admDia, admMes, v);
                    }}
                    className="rounded-xl h-12 text-base text-center"
                  />
                </div>
              </div>
              {dataAdmissao && dataAdmissao < hoje && (
                <p className="text-xs text-muted-foreground">
                  → {mesesHistorico} meses · ~{diasUteisEstimados} dias úteis
                </p>
              )}
            </div>

            <hr className="border-border" />

            {/* Períodos de trabalho */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {periodos.length > 1 ? 'Períodos de trabalho' : 'Horário de trabalho'}
                </label>
                {periodos.length === 1 && (
                  <button
                    onClick={addPeriodo}
                    className="text-xs text-accent font-semibold flex items-center gap-1"
                  >
                    <Plus size={14} /> Mudou de turno?
                  </button>
                )}
              </div>

              {periodos.map((periodo, idx) => (
                <div key={periodo.id} className="space-y-3 p-3 rounded-xl border border-border bg-muted/30">
                  {periodos.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent">
                        Período {idx + 1}
                        {idx === periodos.length - 1 ? ' (atual → hoje)' : ''}
                      </span>
                      <button onClick={() => removePeriodo(periodo.id)} className="text-xs text-destructive flex items-center gap-1">
                        <Trash2 size={12} /> Remover
                      </button>
                    </div>
                  )}

                  {/* Data fim do período (only for non-last periods) */}
                  {periodos.length > 1 && idx < periodos.length - 1 && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Até quando trabalhou nesse horário?</label>
                      <div className="flex gap-2">
                        <Input
                          type="text" inputMode="numeric" maxLength={2} placeholder="DD"
                          value={periodo.dataFimDia}
                          onChange={(e) => updatePeriodoDataFim(periodo.id, e.target.value.replace(/\D/g, '').slice(0, 2), periodo.dataFimMes, periodo.dataFimAno)}
                          className="rounded-xl h-10 text-sm text-center flex-1"
                        />
                        <Input
                          type="text" inputMode="numeric" maxLength={2} placeholder="MM"
                          value={periodo.dataFimMes}
                          onChange={(e) => updatePeriodoDataFim(periodo.id, periodo.dataFimDia, e.target.value.replace(/\D/g, '').slice(0, 2), periodo.dataFimAno)}
                          className="rounded-xl h-10 text-sm text-center flex-1"
                        />
                        <Input
                          type="text" inputMode="numeric" maxLength={4} placeholder="AAAA"
                          value={periodo.dataFimAno}
                          onChange={(e) => updatePeriodoDataFim(periodo.id, periodo.dataFimDia, periodo.dataFimMes, e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="rounded-xl h-10 text-sm text-center flex-[1.5]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Entrada</label>
                      <Input
                        type="time"
                        value={periodo.entradaHora}
                        onChange={(e) => updatePeriodo(periodo.id, 'entradaHora', e.target.value)}
                        className="rounded-xl h-10 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Saída</label>
                      <Input
                        type="time"
                        value={periodo.saidaHora}
                        onChange={(e) => updatePeriodo(periodo.id, 'saidaHora', e.target.value)}
                        className="rounded-xl h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Intervalo (min)</label>
                    <Input
                      type="number"
                      value={periodo.intervaloMin}
                      onChange={(e) => updatePeriodo(periodo.id, 'intervaloMin', e.target.value)}
                      className="rounded-xl h-10 text-sm"
                      min={0} max={120}
                    />
                  </div>

                  {/* Dias da semana */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Dias trabalhados</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {diasOrdenados.map(({ label, idx }) => (
                        <button
                          key={idx}
                          onClick={() => toggleDia(periodo.id, idx)}
                          className={`px-2.5 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors ${
                            periodo.diasSemana.includes(idx)
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {periodos.length > 1 && (
                <button
                  onClick={addPeriodo}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Adicionar outro período
                </button>
              )}
            </div>

            <hr className="border-border" />

            {/* Banco de horas */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Banco de horas atual</label>
              <p className="text-xs text-muted-foreground">
                Você já sabe quantas horas extras acumulou nesse período?
              </p>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={sabeSaldo}
                  onCheckedChange={(v) => setSabeSaldo(!!v)}
                  id="sabe-saldo"
                />
                <label htmlFor="sabe-saldo" className="text-sm cursor-pointer">
                  Sei o saldo atual
                </label>
              </div>

              {sabeSaldo && (
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground">Horas</label>
                    <Input
                      type="number"
                      value={saldoHoras}
                      onChange={(e) => setSaldoHoras(e.target.value)}
                      className="rounded-xl h-12 text-base w-20"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Minutos</label>
                    <Input
                      type="number"
                      value={saldoMinutos}
                      onChange={(e) => setSaldoMinutos(e.target.value)}
                      className="rounded-xl h-12 text-base w-20"
                      min={0}
                      max={59}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Os registros serão marcados como "Reconstituídos" e podem ser editados a qualquer momento.
              </p>
            </div>
          </div>
        )}

        {/* Step 7 - Processando */}
        {step === 7 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Zap className="w-12 h-12 text-accent animate-pulse" />
            <h2 className="text-xl font-bold text-center">Gerando seu histórico...</h2>
            <div className="w-full">
              <Progress value={progresso} className="h-3" />
              <p className="text-sm text-muted-foreground text-center mt-2">{progresso}%</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">{progressoMsg}</p>
            <p className="text-xs text-muted-foreground text-center">
              Isso pode levar alguns segundos.
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 7 && (
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl h-12">
                Voltar
              </Button>
            )}
            <Button
              onClick={next}
              disabled={!canAdvance() || loading}
              className="flex-1 bg-primary text-primary-foreground rounded-xl h-12 text-base font-semibold"
            >
              {loading
                ? 'Salvando...'
                : step === 5 && escolhaHistorico === 'zero'
                  ? 'Finalizar'
                  : step === 6
                    ? '⚡ Gerar histórico'
                    : 'Continuar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
