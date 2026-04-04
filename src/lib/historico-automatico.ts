import { supabase } from '@/integrations/supabase/client';
import { getFeriadosDoAno } from '@/lib/feriados';

export interface HistoricoConfig {
  dataInicio: string;       // 'YYYY-MM-DD'
  dataFim: string;          // 'YYYY-MM-DD'
  entradaHora: string;      // 'HH:MM'
  saidaHora: string;        // 'HH:MM'
  intervaloMin: number;     // ex: 60
  diasSemana: number[];     // [1,2,3,4,5] = seg a sex (0=dom)
  saldoBancoMin: number;    // saldo em minutos
}

export interface PeriodoTrabalho {
  dataInicio: string;       // 'YYYY-MM-DD'
  dataFim: string;          // 'YYYY-MM-DD'
  entradaHora: string;      // 'HH:MM'
  saidaHora: string;        // 'HH:MM'
  intervaloMin: number;
  diasSemana: number[];
}

type TipoMarcacaoHistorico = 'entrada' | 'saida_intervalo' | 'volta_intervalo' | 'saida_final';

function calcularMinutosTrabalhados(entrada: string, saida: string, intervalo: number): number {
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  let totalMin = (sh * 60 + sm) - (eh * 60 + em);
  if (totalMin < 0) totalMin += 24 * 60; // turno que cruza meia-noite
  return totalMin - intervalo;
}

function calcularHorarioIntervalo(
  entradaHora: string,
  saidaHora: string,
  intervaloMin: number
): { saidaIntervalo: string; voltaIntervalo: string } {
  const minTrabalhados = calcularMinutosTrabalhados(entradaHora, saidaHora, intervaloMin);
  const metade = Math.floor(minTrabalhados / 2);

  const [eh, em] = entradaHora.split(':').map(Number);
  const saidaIntMin = eh * 60 + em + metade;
  const voltaIntMin = saidaIntMin + intervaloMin;

  const fmt = (m: number) => {
    const totalM = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')}`;
  };

  return {
    saidaIntervalo: fmt(saidaIntMin),
    voltaIntervalo: fmt(voltaIntMin),
  };
}

function getFeriadosDatas(anoInicio: number, anoFim: number): Set<string> {
  const set = new Set<string>();
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (const f of getFeriadosDoAno(ano)) {
      set.add(f.data);
    }
  }
  return set;
}

export async function gerarHistoricoAutomatico(
  userId: string,
  config: HistoricoConfig,
  onProgress?: (pct: number, msg: string) => void
): Promise<{ totalDias: number; totalMarcacoes: number }> {
  // Delegate to multi-period version with a single period
  return gerarHistoricoMultiPeriodo(
    userId,
    [{
      dataInicio: config.dataInicio,
      dataFim: config.dataFim,
      entradaHora: config.entradaHora,
      saidaHora: config.saidaHora,
      intervaloMin: config.intervaloMin,
      diasSemana: config.diasSemana,
    }],
    config.saldoBancoMin,
    onProgress,
  );
}

export async function gerarHistoricoMultiPeriodo(
  userId: string,
  periodos: PeriodoTrabalho[],
  saldoBancoMin: number,
  onProgress?: (pct: number, msg: string) => void
): Promise<{ totalDias: number; totalMarcacoes: number }> {
  const BATCH_SIZE = 200;
  const marcacoes: any[] = [];

  // Sort periods by start date
  const sorted = [...periodos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  const globalStart = sorted[0].dataInicio;
  const globalEnd = sorted[sorted.length - 1].dataFim;

  const anoInicio = parseInt(globalStart.substring(0, 4));
  const anoFim = parseInt(globalEnd.substring(0, 4));
  const feriados = getFeriadosDatas(anoInicio, anoFim);

  let totalDias = 0;

  // For each period, generate marcações with that period's schedule
  for (const periodo of sorted) {
    const { saidaIntervalo, voltaIntervalo } = calcularHorarioIntervalo(
      periodo.entradaHora,
      periodo.saidaHora,
      periodo.intervaloMin
    );

    let dataAtual = new Date(periodo.dataInicio + 'T12:00:00');
    const dataFim = new Date(periodo.dataFim + 'T12:00:00');

    while (dataAtual <= dataFim) {
      const diaSemana = dataAtual.getDay();
      const dataStr = dataAtual.toISOString().split('T')[0];

      if (periodo.diasSemana.includes(diaSemana) && !feriados.has(dataStr)) {
        totalDias++;

        const makeMarcacao = (tipo: TipoMarcacaoHistorico, hora: string) => {
          const [h, m] = hora.split(':').map(Number);
          const localDate = new Date(
            parseInt(dataStr.substring(0, 4)),
            parseInt(dataStr.substring(5, 7)) - 1,
            parseInt(dataStr.substring(8, 10)),
            h, m, 0
          );
          return {
            user_id: userId,
            data: dataStr,
            tipo,
            horario: localDate.toISOString(),
            origem: 'importacao_automatica',
          };
        };

        marcacoes.push(
          makeMarcacao('entrada', periodo.entradaHora),
          makeMarcacao('saida_intervalo', saidaIntervalo),
          makeMarcacao('volta_intervalo', voltaIntervalo),
          makeMarcacao('saida_final', periodo.saidaHora)
        );
      }

      dataAtual.setDate(dataAtual.getDate() + 1);
    }
  }

  // Insert in batches
  for (let i = 0; i < marcacoes.length; i += BATCH_SIZE) {
    const lote = marcacoes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('marcacoes_ponto').insert(lote);
    if (error) throw new Error(`Erro ao inserir lote: ${error.message}`);

    const pct = Math.min(95, Math.round((i / marcacoes.length) * 100));
    const diasProcessados = Math.round((i / marcacoes.length) * totalDias);
    onProgress?.(pct, `${diasProcessados} de ${totalDias} dias processados`);
  }

  onProgress?.(97, 'Salvando configurações...');

  // Save banco de horas initial balance
  const updateData: any = {
    historico_importado: true,
    historico_inicio: globalStart,
  };

  if (saldoBancoMin > 0) {
    updateData.banco_horas_saldo_inicial = saldoBancoMin;
    updateData.banco_horas_saldo_inicial_data = globalStart;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (profileError) throw new Error(`Erro ao atualizar perfil: ${profileError.message}`);

  onProgress?.(100, 'Concluído!');

  return { totalDias, totalMarcacoes: marcacoes.length };
}

export function contarDiasUteis(dataInicio: string, dataFim: string, diasSemana: number[]): number {
  const anoInicio = parseInt(dataInicio.substring(0, 4));
  const anoFim = parseInt(dataFim.substring(0, 4));
  const feriados = getFeriadosDatas(anoInicio, anoFim);

  let count = 0;
  const d = new Date(dataInicio + 'T12:00:00');
  const fim = new Date(dataFim + 'T12:00:00');
  while (d <= fim) {
    const ds = d.toISOString().split('T')[0];
    if (diasSemana.includes(d.getDay()) && !feriados.has(ds)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
