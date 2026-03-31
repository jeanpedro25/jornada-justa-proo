/**
 * Jornada / schedule helpers
 */

export type TipoJornada = 'jornada_fixa' | 'escala' | 'turno';

export interface EscalaConfig {
  tipo: string; // 5x2, 6x1, 12x36, custom
  diasTrabalho: number;
  diasFolga: number;
  inicio: string; // ISO date
}

/**
 * Given an escala config and a date, returns whether that date is a work day.
 */
export function isDiaTrabalhoEscala(config: EscalaConfig, dateStr: string): boolean {
  if (!config.inicio) return true; // no start date, assume work day
  const start = new Date(config.inicio);
  const target = new Date(dateStr);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (86400000));
  if (diffDays < 0) return true;
  const cycleLength = config.diasTrabalho + config.diasFolga;
  const posInCycle = diffDays % cycleLength;
  return posInCycle < config.diasTrabalho;
}

/**
 * Get the expected daily work hours based on jornada type.
 * For 12x36, it's 12h. Otherwise uses cargaHorariaDiaria.
 */
export function getCargaDiaria(
  tipoJornada: TipoJornada,
  escalaTipo: string | null,
  cargaHorariaDiaria: number,
): number {
  if (tipoJornada === 'escala' && escalaTipo === '12x36') return 12;
  return cargaHorariaDiaria;
}

/**
 * Calculate total worked minutes from an array of records (periods).
 */
export function calcTotalWorkedMinutes(
  registros: Array<{ entrada: string; saida: string | null }>,
): number {
  return registros.reduce((total, r) => {
    if (!r.saida) return total;
    const diffMs = new Date(r.saida).getTime() - new Date(r.entrada).getTime();
    return total + Math.max(0, diffMs / 60000);
  }, 0);
}

/**
 * Calculate pause/lunch minutes between consecutive periods.
 */
export function calcPauseMinutes(
  registros: Array<{ entrada: string; saida: string | null }>,
): number {
  let total = 0;
  for (let i = 1; i < registros.length; i++) {
    const prevSaida = registros[i - 1].saida;
    if (prevSaida) {
      const gap = (new Date(registros[i].entrada).getTime() - new Date(prevSaida).getTime()) / 60000;
      total += Math.max(0, gap);
    }
  }
  return Math.round(total);
}
