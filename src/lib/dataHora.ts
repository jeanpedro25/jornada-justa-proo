/**
 * Utilitário central de data e hora — Hora Justa
 * Todas as conversões UTC ↔ fuso local passam por aqui.
 */

export const fusoLocal = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Timestamp UTC → hora local "HH:MM" */
export function formatarHora(timestamp: string | null | undefined): string {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fusoLocal,
  });
}

/** Timestamp UTC → data local "DD/MM/AAAA" */
export function formatarData(timestamp: string | null | undefined): string {
  if (!timestamp) return '--/--/----';
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: fusoLocal,
  });
}

/** Timestamp UTC → "segunda-feira, 31 de março" */
export function formatarDataExtenso(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: fusoLocal,
  });
}

/** Data de hoje no fuso local → "YYYY-MM-DD" (para queries Supabase) */
export function dataHojeLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fusoLocal }).format(new Date());
}

/** Agora em UTC ISO string (para salvar no Supabase) */
export function agoraUTC(): string {
  return new Date().toISOString();
}

/** Diferença em minutos entre dois timestamps UTC */
export function diferencaMinutos(inicio: string, fim: string): number {
  return Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));
}

/** Minutos → "Xh Ymin" */
export function formatarDuracao(minutos: number): string {
  if (minutos <= 0) return '0min';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** Verifica se um timestamp UTC é de hoje no fuso local */
export function ehHoje(timestamp: string): boolean {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fusoLocal }).format(new Date(timestamp)) === dataHojeLocal();
}

/** Hora local agora "HH:MM" */
export function horaLocalAgora(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fusoLocal,
  });
}
