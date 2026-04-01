/**
 * Jornada / schedule helpers — Hora Justa
 * Central module: all punch logic uses marcacoes_ponto table.
 */

import { supabase } from '@/integrations/supabase/client';
import { fusoLocal } from '@/lib/dataHora';

// ─── TYPES ──────────────────────────────────────

export type TipoMarcacao = 'entrada' | 'saida_intervalo' | 'volta_intervalo' | 'saida_final';

export interface Marcacao {
  id: string;
  user_id: string;
  data: string;
  tipo: TipoMarcacao;
  horario: string;
  origem: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Periodo {
  inicio: string;
  fim: string | null;
  minutos: number;
  parcial?: boolean;
}

export interface JornadaDia {
  periodos: Periodo[];
  intervalos: Periodo[];
  totalTrabalhado: number;   // minutos
  totalIntervalo: number;    // minutos
  emAndamento: boolean;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
}

export type TipoJornada = 'jornada_fixa' | 'escala' | 'turno';

export interface EscalaConfig {
  tipo: string;
  diasTrabalho: number;
  diasFolga: number;
  inicio: string;
}

// ─── FORMATAÇÃO ─────────────────────────────────

export function formatarHoraLocal(ts: string | null): string {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: fusoLocal,
  });
}

export function hojeLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fusoLocal }).format(new Date());
}

// ─── BUSCAR MARCAÇÕES DO DIA ────────────────────

export async function buscarMarcacoesDia(userId: string, data: string): Promise<Marcacao[]> {
  const { data: marcacoes } = await supabase
    .from('marcacoes_ponto')
    .select('*')
    .eq('user_id', userId)
    .eq('data', data)
    .is('deleted_at', null)
    .order('horario', { ascending: true });
  return (marcacoes as Marcacao[]) || [];
}

// ─── CALCULAR JORNADA A PARTIR DAS MARCAÇÕES ───

function difMin(inicio: string, fim: string): number {
  return Math.max(0, Math.round(
    (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000
  ));
}

export function calcularJornada(marcacoes: Marcacao[]): JornadaDia {
  let totalTrabalhado = 0;
  let totalIntervalo = 0;
  const periodos: Periodo[] = [];
  const intervalos: Periodo[] = [];
  let inicioAtual: string | null = null;
  let saidaIntervalo: string | null = null;

  for (const m of marcacoes) {
    if (m.tipo === 'entrada' || m.tipo === 'volta_intervalo') {
      // If we had a pending interval, close it
      if (m.tipo === 'volta_intervalo' && saidaIntervalo) {
        const durInt = difMin(saidaIntervalo, m.horario);
        intervalos.push({ inicio: saidaIntervalo, fim: m.horario, minutos: durInt });
        totalIntervalo += durInt;
        saidaIntervalo = null;
      }
      inicioAtual = m.horario;
    }

    if (m.tipo === 'saida_intervalo' && inicioAtual) {
      const minutos = difMin(inicioAtual, m.horario);
      periodos.push({ inicio: inicioAtual, fim: m.horario, minutos });
      totalTrabalhado += minutos;
      saidaIntervalo = m.horario;
      inicioAtual = null;
    }

    if (m.tipo === 'saida_final') {
      if (inicioAtual) {
        const minutos = difMin(inicioAtual, m.horario);
        periodos.push({ inicio: inicioAtual, fim: m.horario, minutos });
        totalTrabalhado += minutos;
      }
      // Close any pending interval
      if (saidaIntervalo && !inicioAtual) {
        // volta_intervalo was already processed above
      }
      inicioAtual = null;
      saidaIntervalo = null;
    }
  }

  // If still in service (entrada/volta without saida)
  const emAndamento = inicioAtual !== null;
  if (emAndamento && inicioAtual) {
    const minutosParcial = difMin(inicioAtual, new Date().toISOString());
    periodos.push({ inicio: inicioAtual, fim: null, minutos: minutosParcial, parcial: true });
    totalTrabalhado += minutosParcial;
  }

  // If in interval (saida_intervalo without volta)
  const emIntervalo = saidaIntervalo !== null && !emAndamento;

  return {
    periodos,
    intervalos,
    totalTrabalhado,
    totalIntervalo,
    emAndamento: emAndamento || emIntervalo,
    primeiraEntrada: marcacoes.find(m => m.tipo === 'entrada')?.horario || null,
    ultimaSaida: marcacoes.filter(m => m.tipo === 'saida_final').pop()?.horario || null,
  };
}

// ─── ESTADO ATUAL DA JORNADA ────────────────────

export type EstadoJornada = 'nao_iniciada' | 'trabalhando' | 'em_intervalo' | 'encerrada';

export function getEstadoJornada(marcacoes: Marcacao[]): EstadoJornada {
  if (marcacoes.length === 0) return 'nao_iniciada';
  const ultima = marcacoes[marcacoes.length - 1];
  if (ultima.tipo === 'saida_final') return 'encerrada';
  if (ultima.tipo === 'saida_intervalo') return 'em_intervalo';
  return 'trabalhando'; // entrada or volta_intervalo
}

// ─── PRÓXIMO TIPO DE MARCAÇÃO ───────────────────

export function proximoTipo(marcacoes: Marcacao[]): {
  tipo: TipoMarcacao;
  label: string;
  icone: string;
  cor: string;
} {
  const estado = getEstadoJornada(marcacoes);

  switch (estado) {
    case 'nao_iniciada':
      return { tipo: 'entrada', label: 'Bater Entrada', icone: '▶', cor: 'success' };
    case 'trabalhando':
      return { tipo: 'saida_intervalo', label: 'Saída Intervalo', icone: '🍽', cor: 'warning' };
    case 'em_intervalo':
      return { tipo: 'volta_intervalo', label: 'Voltei do Intervalo', icone: '↩', cor: 'accent' };
    case 'encerrada':
      return { tipo: 'entrada', label: 'Nova Entrada', icone: '▶', cor: 'success' };
    default:
      return { tipo: 'entrada', label: 'Bater Entrada', icone: '▶', cor: 'success' };
  }
}

// Special: after volta_intervalo, next should be saida_final
export function proximoTipoAvancado(marcacoes: Marcacao[]): {
  tipo: TipoMarcacao;
  label: string;
  icone: string;
  cor: string;
  alternativo?: { tipo: TipoMarcacao; label: string; icone: string; cor: string };
} {
  const estado = getEstadoJornada(marcacoes);
  const temIntervalo = marcacoes.some(m => m.tipo === 'saida_intervalo');

  if (estado === 'trabalhando') {
    if (temIntervalo) {
      // Already had interval, next is final exit
      return {
        tipo: 'saida_final',
        label: 'Bater Saída Final',
        icone: '⏹',
        cor: 'destructive',
        alternativo: { tipo: 'saida_intervalo', label: 'Outro Intervalo', icone: '🍽', cor: 'warning' },
      };
    }
    return {
      tipo: 'saida_intervalo',
      label: 'Saída Intervalo',
      icone: '🍽',
      cor: 'warning',
      alternativo: { tipo: 'saida_final', label: 'Saída Final (sem intervalo)', icone: '⏹', cor: 'destructive' },
    };
  }

  if (estado === 'em_intervalo') {
    return { tipo: 'volta_intervalo', label: 'Voltei do Intervalo', icone: '↩', cor: 'accent' };
  }

  if (estado === 'encerrada') {
    return { tipo: 'entrada', label: 'Nova Entrada', icone: '▶', cor: 'success' };
  }

  return { tipo: 'entrada', label: 'Bater Entrada', icone: '▶', cor: 'success' };
}

// ─── REGISTRAR MARCAÇÃO ─────────────────────────

export async function registrarMarcacao(userId: string, tipo: TipoMarcacao, origem: 'botao' | 'manual' | 'correcao' = 'botao') {
  const agora = new Date().toISOString();
  const data = hojeLocal();

  const { data: nova, error } = await supabase
    .from('marcacoes_ponto')
    .insert({
      user_id: userId,
      data,
      tipo,
      horario: agora,
      origem,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return nova as Marcacao;
}

// ─── INSERIR MARCAÇÃO MANUAL (data específica) ──

export async function inserirMarcacaoManual(
  userId: string,
  data: string,
  tipo: TipoMarcacao,
  horario: string,
) {
  const { data: nova, error } = await supabase
    .from('marcacoes_ponto')
    .insert({
      user_id: userId,
      data,
      tipo,
      horario,
      origem: 'manual',
    } as any)
    .select()
    .single();

  if (error) throw error;
  return nova as Marcacao;
}

// ─── CALCULAR HORA EXTRA ────────────────────────

export function calcularHoraExtra(
  totalTrabalhadoMin: number,
  cargaHorariaDiariaHoras: number,
): number {
  const cargaMin = cargaHorariaDiariaHoras * 60;
  return Math.max(0, (totalTrabalhadoMin - cargaMin)) / 60;
}

// ─── FORMATAR DURAÇÃO ───────────────────────────

export function formatarDuracaoJornada(minutos: number): string {
  if (minutos <= 0) return '0min';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── ESCALA HELPERS ─────────────────────────────

export function isDiaTrabalhoEscala(config: EscalaConfig, dateStr: string): boolean {
  if (!config.inicio) return true;
  const start = new Date(config.inicio);
  const target = new Date(dateStr);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return true;
  const cycleLength = config.diasTrabalho + config.diasFolga;
  const posInCycle = diffDays % cycleLength;
  return posInCycle < config.diasTrabalho;
}

export function getCargaDiaria(
  tipoJornada: TipoJornada,
  escalaTipo: string | null,
  cargaHorariaDiaria: number,
): number {
  if (tipoJornada === 'escala' && escalaTipo === '12x36') return 12;
  return cargaHorariaDiaria;
}

// ─── ÍCONE E COR DA MARCAÇÃO ────────────────────

export function getMarcacaoVisual(tipo: TipoMarcacao) {
  switch (tipo) {
    case 'entrada': return { icone: '🟢', label: 'Entrada', cor: 'text-success' };
    case 'saida_intervalo': return { icone: '🟡', label: 'Saída intervalo', cor: 'text-warning' };
    case 'volta_intervalo': return { icone: '🔵', label: 'Volta intervalo', cor: 'text-accent' };
    case 'saida_final': return { icone: '🔴', label: 'Saída final', cor: 'text-destructive' };
  }
}
