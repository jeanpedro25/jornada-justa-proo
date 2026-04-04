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
  const BATCH_SIZE = 200;
  const marcacoes: any[] = [];

  const anoInicio = parseInt(config.dataInicio.substring(0, 4));
  const anoFim = parseInt(config.dataFim.substring(0, 4));
  const feriados = getFeriadosDatas(anoInicio, anoFim);

  const { saidaIntervalo, voltaIntervalo } = calcularHorarioIntervalo(
    config.entradaHora,
    config.saidaHora,
    config.intervaloMin
  );

  let dataAtual = new Date(config.dataInicio + 'T12:00:00');
  const dataFim = new Date(config.dataFim + 'T12:00:00');
  let totalDias = 0;

  // Count total working days first for progress
  const tempDate = new Date(dataAtual);
  let totalDiasUteis = 0;
  while (tempDate <= dataFim) {
    const ds = tempDate.toISOString().split('T')[0];
    if (config.diasSemana.includes(tempDate.getDay()) && !feriados.has(ds)) {
      totalDiasUteis++;
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  while (dataAtual <= dataFim) {
    const diaSemana = dataAtual.getDay();
    const dataStr = dataAtual.toISOString().split('T')[0];

    if (config.diasSemana.includes(diaSemana) && !feriados.has(dataStr)) {
      totalDias++;

      const makeMarcacao = (tipo: string, hora: string) => ({
        user_id: userId,
        data: dataStr,
        tipo,
        horario: `${dataStr}T${hora}:00`,
        origem: 'manual',
      });

      marcacoes.push(
        makeMarcacao('entrada', config.entradaHora),
        makeMarcacao('saida_intervalo', saidaIntervalo),
        makeMarcacao('volta_intervalo', voltaIntervalo),
        makeMarcacao('saida', config.saidaHora)
      );
    }

    dataAtual.setDate(dataAtual.getDate() + 1);
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
    historico_inicio: config.dataInicio,
  };

  if (config.saldoBancoMin > 0) {
    updateData.banco_horas_saldo_inicial = config.saldoBancoMin;
    updateData.banco_horas_saldo_inicial_data = config.dataInicio;
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
