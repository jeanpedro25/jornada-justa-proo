/**
 * RADAR TRABALHISTA – Motor de Análise CLT (Versão Narrativa Simplificada)
 * Identifica padrões e inconsistências da CLT.
 */
import { type BancoHorasEntry } from '@/lib/banco-horas';

export type NivelAlerta = 'alto' | 'medio' | 'baixo';

export interface AlertaRadar {
  id: string;
  nivel: NivelAlerta;
  emoji: string;
  titulo: string;
  narrativa: string;       // texto corrido, como story (usado no lugar de descricao)
  periodo: string;
  ocorrencias?: string[];  // lista de datas/eventos específicos
  recomendacao: string;
  clt: string;             // (usado no lugar de referenciaCLT)
  valorEstimado?: number;
}

export interface RadarInput {
  days: any[];
  bancoSaldoMin: number;
  bancoDataPrimeiro?: string | null;
  created_at?: string | null;
  data_admissao?: string | null;
  salario: number;
  percentualHE: number;
  cargaHoras: number; // horas/dia
  /**
   * Quando true (padrão), ignora dias cujo ponto foi gerado por importação/reconstrução automática.
   * A análise considera apenas registros reais ou lançados manualmente pelo usuário.
   */
  excluirReconstituidos?: boolean;
}

function fmtData(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtHM(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

function diffMeses(d1: Date, d2: Date): number {
  return Math.max(0, (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth());
}

/** Texto jurídico neutro: responsabilidade dos dados permanece com o usuário (exibido no app/PDF). */
export const RADAR_ISENCAO_RODAPE =
  'Indicador automatizado para organização pessoal. Não constitui parecer jurídico nem certifica fatos; a responsabilidade pela veracidade dos registros é exclusiva do usuário.';

export function analisarRadarTrabalhista(input: RadarInput): AlertaRadar[] {
  const { bancoSaldoMin, bancoDataPrimeiro, salario, percentualHE } = input;
  const excluirReconst = input.excluirReconstituidos !== false;
  const days = excluirReconst
    ? input.days.filter((d: any) => d.registroOrigem !== 'reconstituido')
    : input.days;

  const alertas: AlertaRadar[] = [];
  const hoje = new Date();
  const vhExtra = salario > 0 ? (salario / 220) * (1 + percentualHE / 100) : 0;
  const diasUteis = days.filter(d => d.ehDiaTrabalho === true && d.origem !== 'fds' && d.origem !== 'folga' && d.origem !== 'ferias' && d.origem !== 'atestado');

  // ── 1. Banco de horas ────────────────────────────────────────────────────
  if (bancoSaldoMin > 60) {
    const dataPrimeiro = bancoDataPrimeiro ? new Date(bancoDataPrimeiro + 'T12:00:00') : null;
    const messesSemComp = dataPrimeiro ? diffMeses(dataPrimeiro, hoje) : 0;
    const saldoH = Math.round(bancoSaldoMin / 60);
    const estimativa = vhExtra > 0 ? Math.round(bancoSaldoMin / 60 * vhExtra) : 0;

    if (messesSemComp >= 6) {
      const dataInicioStr = bancoDataPrimeiro ? fmtData(bancoDataPrimeiro) : '—';
      alertas.push({
        id: 'banco_horas_vencido',
        nivel: 'alto',
        emoji: '⏳',
        titulo: 'Banco de Horas Acumulado Há Mais de 6 Meses',
        narrativa: `À vista dos registros informados pelo usuário, identifica-se saldo de banco de horas não compensado em folga há aproximadamente ${messesSemComp} meses (referência de primeiro acúmulo: ${dataInicioStr}), com saldo estimado de ${saldoH}h. A habitualidade de prazos excessivos para compensação pode ensejar discussão quanto à observância do regime legal de horas suplementares.`,
        periodo: `Desde ${dataInicioStr} (${messesSemComp} meses sem compensação)`,
        ocorrencias: bancoDataPrimeiro ? [`Primeiro acúmulo: ${dataInicioStr}`, `Saldo acumulado: ${fmtHM(bancoSaldoMin)}`] : undefined,
        recomendacao: 'Cabe ao trabalhador verificar acordo coletivo, normas internas e controles oficiais de ponto antes de qualquer medida.',
        clt: 'CLT Art. 59 e 59-B — Banco de horas e prazo de compensação',
        valorEstimado: estimativa > 0 ? estimativa : undefined,
      });
    } else if (bancoSaldoMin > 120) {
      alertas.push({
        id: 'banco_horas_elevado',
        nivel: 'medio',
        emoji: '📈',
        titulo: 'Saldo Elevado no Banco de Horas',
        narrativa: `Nos termos dos lançamentos informados pelo usuário, o saldo de banco de horas encontra-se estimado em ${saldoH}h. Saldo elevado, ainda que dentro de eventual prazo convencional, pode indicar necessidade de acompanhamento quanto à programação de compensações.`,
        periodo: 'Período atual',
        recomendacao: 'Sugerem-se conferência de acordos aplicáveis e de extratos oficiais, sem imputação automática de débito ao empregador.',
        clt: 'CLT Art. 59 — Horas suplementares e banco de horas',
        valorEstimado: estimativa > 0 ? estimativa : undefined,
      });
    }
  }

  // ── 2. Horas extras excessivas (>2h/dia) ─────────────────────────────────
  const diasMais2h = diasUteis.filter(d => d.extraMin >= 120);
  if (diasMais2h.length > 0) {
    const totalExtraMin = diasMais2h.reduce((s, d) => s + d.extraMin, 0);
    const exemplos = diasMais2h.slice(0, 5).map(d => `${fmtData(d.data)}: ${fmtHM(d.extraMin)} extras`);
    const estimativa = vhExtra > 0 ? Math.round(totalExtraMin / 60 * vhExtra) : 0;

    alertas.push({
      id: 'extras_excessivas',
      nivel: diasMais2h.length >= 5 ? 'alto' : 'medio',
      emoji: '🕐',
      titulo: `${diasMais2h.length} Dia(s) com Mais de 2h Extras`,
      narrativa: `Dos registros informados pelo usuário, constatam-se ${diasMais2h.length} dia(s) com horas extras estimadas em patamar superior a duas horas diárias, o que, em tese, aproxima-se do limite legal usual de duração da jornada (8h + 2h extras).`,
      periodo: `${diasMais2h.length} dia(s) identificado(s)`,
      ocorrencias: exemplos,
      recomendacao: 'A conferência com documentos oficiais e negociais vigentes é indispensável; este indicador não presume ilícito por parte do empregador.',
      clt: 'CLT Art. 59 §1º — Limite de 2h extras por dia de trabalho',
      valorEstimado: estimativa > 0 ? estimativa : undefined,
    });
  }

  // ── 3. Intervalo insuficiente ─────────────────────────────────────────────
  const semIntervalo6h = diasUteis.filter(d => d.totalMin > 360 && d.intervaloMin > 0 && d.intervaloMin < 60);
  const semIntervalo4h = diasUteis.filter(d => d.totalMin > 240 && d.totalMin <= 360 && d.intervaloMin > 0 && d.intervaloMin < 15);

  if (semIntervalo6h.length > 0) {
    const exemplos = semIntervalo6h.slice(0, 5).map(d => `${fmtData(d.data)}: intervalo de apenas ${fmtHM(d.intervaloMin)}`);
    alertas.push({
      id: 'intervalo_6h',
      nivel: semIntervalo6h.length >= 5 ? 'alto' : 'medio',
      emoji: '🍽️',
      titulo: `Intervalo de Almoço Abaixo do Mínimo em ${semIntervalo6h.length} Dia(s)`,
      narrativa: `Com base nos dados informados, foram identificados ${semIntervalo6h.length} dia(s) com jornada superior a 6h em que o intervalo registrado foi inferior a 1 hora. A CLT garante ao trabalhador no mínimo 1h de intervalo intrajornada em jornadas acima de 6h.`,
      periodo: `${semIntervalo6h.length} dia(s) no período`,
      ocorrencias: exemplos,
      recomendacao: 'Recomenda-se verificar se os intervalos estão sendo efetivamente usufruídos e registrados de forma correta.',
      clt: 'CLT Art. 71 e Súmula 437 TST — Intervalo intrajornada mínimo de 1h',
    });
  }

  if (semIntervalo4h.length > 0) {
    alertas.push({
      id: 'intervalo_4h',
      nivel: 'medio',
      emoji: '☕',
      titulo: `Intervalo Mínimo de 15 Min Não Identificado em ${semIntervalo4h.length} Dia(s)`,
      narrativa: `Com base nos dados informados, foram identificados ${semIntervalo4h.length} dia(s) com jornada entre 4h e 6h onde o intervalo registrado foi inferior a 15 minutos. Para jornadas nessa faixa, a CLT garante um intervalo mínimo de 15 minutos.`,
      periodo: `${semIntervalo4h.length} dia(s) no período`,
      recomendacao: 'Verifique com o RH se os intervalos de, no mínimo, 15 minutos estão sendo assegurados nas jornadas parciais.',
      clt: 'CLT Art. 71 §1º — Intervalo de 15min para jornadas entre 4h e 6h',
    });
  }

  // ── 4. Jornada acima de 10h ───────────────────────────────────────────────
  const acima10h = diasUteis.filter((d: any) => d.totalMin > 600);
  if (acima10h.length > 0) {
    const exemplos = acima10h.slice(0, 5).map((d: any) => `${fmtData(d.data)}: ${fmtHM(d.totalMin)} trabalhados`);
    alertas.push({
      id: 'jornada_10h',
      nivel: acima10h.length >= 3 ? 'alto' : 'medio',
      emoji: '⚠️',
      titulo: `Jornada Superior a 10h em ${acima10h.length} Dia(s)`,
      narrativa: `Com base nos dados informados, foram identificados ${acima10h.length} dia(s) com jornada superior a 10h. A soma da jornada normal de 8h mais as 2h extras máximas permitidas pela CLT resulta em um teto de 10h diárias. Ultrapassar esse limite de forma habitual indica necessidade de revisão do controle de ponto.`,
      periodo: `${acima10h.length} dia(s) no período`,
      ocorrencias: exemplos,
      recomendacao: 'Verifique os registros junto ao controle de ponto oficial. Se confirmado, consulte o RH sobre compensação adequada.',
      clt: 'CLT Art. 59 §2º — Jornada máxima de 10h diárias (8h normais + 2h extras)',
    });
  }

  // ── 5. Semanas acima de 44h ───────────────────────────────────────────────
  const mapSemanas = new Map<string, { totalMin: number; semana: string }>();
  days.forEach((d: any) => {
    if (d.totalMin <= 0) return;
    const dt = new Date(d.data + 'T12:00:00');
    const dow = dt.getDay();
    const diff = dt.getDate() - dow + (dow === 0 ? -6 : 1);
    const seg = new Date(dt); seg.setDate(diff);
    const key = seg.toISOString().split('T')[0];
    const prev = mapSemanas.get(key) || { totalMin: 0, semana: fmtData(key) };
    mapSemanas.set(key, { totalMin: prev.totalMin + d.totalMin, semana: prev.semana });
  });
  const semanasAltas = Array.from(mapSemanas.values()).filter(s => s.totalMin > 44 * 60);
  if (semanasAltas.length > 0) {
    alertas.push({
      id: 'semana_44h',
      nivel: 'medio',
      emoji: '📅',
      titulo: `${semanasAltas.length} Semana(s) com Mais de 44h`,
      narrativa: `Com base nos dados informados, foram estimadas ${semanasAltas.length} semana(s) com carga horária superior às 44h semanais previstas pela constituição. Semanas com carga acima desse limite podem indicar acúmulo de horas extras que deveriam ser remuneradas ou compensadas.`,
      periodo: `${semanasAltas.length} semana(s) identificada(s)`,
      ocorrencias: semanasAltas.slice(0, 3).map(s => `Semana de ${s.semana}: ${fmtHM(s.totalMin)}`),
      recomendacao: 'Verifique o controle de horas semanal e solicite ao RH esclarecimentos sobre compensação ou pagamento das horas excedentes.',
      clt: 'CF/88 Art. 7º XIII — Limite máximo de 44h semanais',
    });
  }

  // ── 6. Férias vencidas/pendentes ──────────────────────────────────────────
  const dataRef = input.data_admissao || input.created_at;
  if (dataRef) {
    const admissao = new Date(dataRef);
    const mesesAdm = diffMeses(admissao, hoje);
    const periodosCompletos = Math.floor(mesesAdm / 12);
    const feriasDias = days.filter((d: any) => d.origem === 'ferias').length;

    if (periodosCompletos >= 1 && feriasDias < periodosCompletos * 30) {
      const vencimento = new Date(admissao);
      vencimento.setFullYear(vencimento.getFullYear() + periodosCompletos);
      const vencido = vencimento < hoje;

      alertas.push({
        id: 'ferias_pendentes',
        nivel: vencido ? 'alto' : 'medio',
        emoji: '🏖️',
        titulo: `${periodosCompletos} Período(s) Aquisitivo(s) de Férias Completado(s)`,
        narrativa: `Com base na data de referência informada (${fmtData(admissao.toISOString().split('T')[0])}), foram identificados ${periodosCompletos} período(s) aquisitivo(s) de férias completado(s). Cada período de 12 meses de trabalho dá ao empregado o direito a 30 dias de férias remuneradas com adicional de 1/3. ${vencido ? 'Atenção: o prazo concessivo pode ter vencido — férias não concedidas no prazo devem ser pagas em dobro.' : ''}`,
        periodo: `${mesesAdm} meses desde ${fmtData(admissao.toISOString().split('T')[0])}`,
        recomendacao: vencido
          ? 'Caso as férias não tenham sido concedidas no prazo concessivo, recomenda-se verificar com o RH e solicitar a regularização (pagamento em dobro).'
          : 'Recomenda-se verificar com o RH a programação de férias referente a esse(s) período(s).',
        clt: 'CLT Art. 130 e 137 — Direito a 30 dias de férias e pagamento em dobro',
      });
    }
  }

  // ── 7. Feriados trabalhados ───────────────────────────────────────────────
  const feriadosTrabalhados = days.filter((d: any) => d.origem === 'feriado' && d.totalMin > 30);
  if (feriadosTrabalhados.length > 0) {
    const totalFerMin = feriadosTrabalhados.reduce((s: number, d: any) => s + d.totalMin, 0);
    const estimativa = vhExtra > 0 ? Math.round(totalFerMin / 60 * vhExtra) : 0;
    const exemplos = feriadosTrabalhados.slice(0, 5).map((d: any) =>
      `${fmtData(d.data)}${d.feriadoNome ? ` (${d.feriadoNome})` : ''}: ${fmtHM(d.totalMin)} trabalhados`
    );
    alertas.push({
      id: 'feriados_trabalhados',
      nivel: 'alto',
      emoji: '🚨',
      titulo: `Trabalho em ${feriadosTrabalhados.length} Feriado(s) Identificado`,
      narrativa: `Com base nos dados informados, foram registradas jornadas em ${feriadosTrabalhados.length} feriado(s). Trabalhar em feriados sem acordo coletivo que preveja compensação pode indicar direito ao pagamento em dobro da hora ou folga compensatória.`,
      periodo: `${feriadosTrabalhados.length} feriado(s) com registro de trabalho`,
      ocorrencias: exemplos,
      recomendacao: 'Verifique com o RH se houve compensação em folga ou pagamento adicional correspondente ao trabalho realizado nos feriados.',
      clt: 'CLT Art. 70 e CF/88 Art. 7º XV — Repouso em feriados',
      valorEstimado: estimativa > 0 ? estimativa : undefined,
    });
  }

  // ── 8. Sequência prolongada de dias corridos com labor (repouso) ─────────
  const datasComTrabalho = [...new Set(diasUteis.filter(d => d.totalMin > 0).map(d => d.data))].sort();
  let maxSeqDias = datasComTrabalho.length ? 1 : 0;
  let curSeqDias = 1;
  for (let i = 1; i < datasComTrabalho.length; i++) {
    const a = new Date(datasComTrabalho[i - 1] + 'T12:00:00');
    const b = new Date(datasComTrabalho[i] + 'T12:00:00');
    const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (diffDays === 1) {
      curSeqDias++;
      maxSeqDias = Math.max(maxSeqDias, curSeqDias);
    } else if (diffDays > 1) {
      curSeqDias = 1;
    }
  }
  if (maxSeqDias >= 12) {
    alertas.push({
      id: 'sequencia_dias_labor',
      nivel: maxSeqDias >= 23 ? 'alto' : 'medio',
      emoji: '📆',
      titulo: `Sequência de ${maxSeqDias} Dia(s) Corridos com Registro de Labor`,
      narrativa:
        `Na sequência dos registros informados pelo usuário (excluídos pontos meramente reconstituídos), verifica-se período de ${maxSeqDias} dias corridos consecutivos com jornada registrada. ` +
        'Padrões prolongados de labor sem intervalo de descanso semanal podem, conforme o caso concreto, relacionar-se à fiscalização do repouso entre jornadas e do repouso semanal remunerado, sem imputação automática de infração.',
      periodo: `Maior sequência: ${maxSeqDias} dia(s) consecutivos`,
      recomendacao:
        'Cabe confrontar com o contrato, normas coletivas e o ponto oficial; eventual questionamento deve ser objeto de análise individualizada por profissional habilitado.',
      clt: 'CLT Art. 66 e 67 — Intervalo entre jornadas e repouso semanal',
    });
  }

  // ── 9. Interjornada Inferior a 11h ─────────────────────────────────────────
  const interjornadaDias = [];
  const diasComPonto = days.filter(d => d.marcacoes && d.marcacoes.length > 0).sort((a, b) => a.data.localeCompare(b.data));
  for (let i = 1; i < diasComPonto.length; i++) {
    const diaAnt = diasComPonto[i - 1];
    const diaAtual = diasComPonto[i];

    const dateAnt = new Date(diaAnt.data + 'T12:00:00');
    const dateAtual = new Date(diaAtual.data + 'T12:00:00');
    const diffDays = Math.round((dateAtual.getTime() - dateAnt.getTime()) / 86400000);

    if (diffDays === 1) {
      const ultimaAnt = diaAnt.marcacoes[diaAnt.marcacoes.length - 1]?.horario;
      const primeiraAtual = diaAtual.marcacoes[0]?.horario;

      if (ultimaAnt && primeiraAtual) {
        const [hA, mA] = ultimaAnt.split(':').map(Number);
        const [hB, mB] = primeiraAtual.split(':').map(Number);
        const horasDescanso = ((24 * 60 - (hA * 60 + mA)) + (hB * 60 + mB)) / 60;
        
        if (horasDescanso > 0 && horasDescanso < 11) {
          interjornadaDias.push({
            dataAnt: diaAnt.data, dataAtual: diaAtual.data,
            ultimaAnt, primeiraAtual,
            descanso: horasDescanso
          });
        }
      }
    }
  }

  if (interjornadaDias.length > 0) {
    const estimativa = vhExtra > 0 ? Math.round(interjornadaDias.reduce((s, d) => s + (11 - d.descanso), 0) * vhExtra) : 0;
    const exemplos = interjornadaDias.slice(0, 5).map(d => `${fmtData(d.dataAnt)} (${d.ultimaAnt}) até ${fmtData(d.dataAtual)} (${d.primeiraAtual}) - ${Math.floor(d.descanso)}h${Math.round((d.descanso % 1) * 60)}m descanso`);

    alertas.push({
      id: 'interjornada_11h',
      nivel: interjornadaDias.length >= 3 ? 'alto' : 'medio',
      emoji: '🛌',
      titulo: `Descanso Interjornada < 11h em ${interjornadaDias.length} Ocorrência(s)`,
      narrativa: `A CLT exige descanso ininterrupto mínimo de 11 horas entre duas jornadas de trabalho. Identificamos ${interjornadaDias.length} episódio(s) onde o intervalo foi inferior a 11h. As horas subtraídas desse descanso caracterizam horas extras.`,
      periodo: `${interjornadaDias.length} ocorrência(s)`,
      ocorrencias: exemplos,
      recomendacao: 'As horas faltantes para completar as 11h de descanso devem ser remuneradas como extras. Verifique se o pagamento ou compensação foi feito.',
      clt: 'CLT Art. 66 e Súmula 436 TST — Descanso mínimo de 11h entre jornadas',
      valorEstimado: estimativa > 0 ? estimativa : undefined,
    });
  }

  // ── 10. Trabalho Noturno ──────────────────────────────────────────────────
  const diasNoturnos = diasComPonto.filter(d => {
    return d.marcacoes.some((m: any) => {
      if (!m.horario) return false;
      const h = Number(m.horario.split(':')[0]);
      return h >= 22 || h < 5;
    });
  });

  if (diasNoturnos.length > 0) {
    const exemplos = diasNoturnos.slice(0, 5).map(d => `${fmtData(d.data)} (Ponto em horário noturno)`);
    alertas.push({
      id: 'trabalho_noturno',
      nivel: 'medio',
      emoji: '🌙',
      titulo: `Trabalho Noturno Identificado em ${diasNoturnos.length} Dia(s)`,
      narrativa: `Identificamos ${diasNoturnos.length} dia(s) com labor entre 22h00 e 05h00. O trabalho realizado nesse período confere direito ao adicional noturno (mínimo de 20%), e cada hora noturna trabalhada equivale a 52 minutos e 30 segundos (hora ficta).`,
      periodo: `${diasNoturnos.length} dia(s) identificados`,
      ocorrencias: exemplos,
      recomendacao: 'Certifique-se nos contracheques se o adicional noturno está sendo aplicado e se o cálculo considera a hora reduzida.',
      clt: 'CLT Art. 73 — Adicional noturno de 20% e hora noturna reduzida',
    });
  }

  // ── 11. Domingos Trabalhados ──────────────────────────────────────────────
  const domingosTrabalhados = diasComPonto.filter(d => {
    const dt = new Date(d.data + 'T12:00:00');
    return dt.getDay() === 0 && d.totalMin > 0 && d.origem !== 'feriado';
  });

  if (domingosTrabalhados.length > 0) {
    const totalDomMin = domingosTrabalhados.reduce((s, d) => s + d.totalMin, 0);
    const estimativa = vhExtra > 0 ? Math.round(totalDomMin / 60 * vhExtra) : 0;
    const exemplos = domingosTrabalhados.slice(0, 5).map(d => `${fmtData(d.data)}: ${fmtHM(d.totalMin)} trabalhados`);

    alertas.push({
      id: 'domingos_trabalhados',
      nivel: domingosTrabalhados.length >= 2 ? 'alto' : 'medio',
      emoji: '☀️',
      titulo: `Trabalho em ${domingosTrabalhados.length} Domingo(s) Sem Feriado`,
      narrativa: `Registramos ${domingosTrabalhados.length} domingo(s) com labor. A lei estabelece que o DSR deve coincidir preferencialmente com o domingo. Sem escala especial (ex: 12x36, comércio) ou folga compensatória na semana, o domingo trabalhado deve ser pago em dobro.`,
      periodo: `${domingosTrabalhados.length} domingo(s) laborado(s)`,
      ocorrencias: exemplos,
      recomendacao: 'Caso não tenha tido folga compensatória na mesma semana, o pagamento dessas horas deve ser com adicional de 100%.',
      clt: 'Lei 605/49 — Repouso Semanal Remunerado preferencialmente aos domingos',
      valorEstimado: estimativa > 0 ? estimativa : undefined,
    });
  }

  return alertas.sort((a, b) => ({ alto: 0, medio: 1, baixo: 2 }[a.nivel] - ({ alto: 0, medio: 1, baixo: 2 }[b.nivel])));
}
