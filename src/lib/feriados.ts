// Feriados nacionais brasileiros 2026
// Inclui feriados fixos + móveis (Páscoa, Corpus Christi, Carnaval)

interface Feriado {
  data: string; // YYYY-MM-DD
  nome: string;
}

const FERIADOS_2026: Feriado[] = [
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-02-16', nome: 'Carnaval' },
  { data: '2026-02-17', nome: 'Carnaval' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa' },
  { data: '2026-04-05', nome: 'Páscoa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-06-04', nome: 'Corpus Christi' },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-12-25', nome: 'Natal' },
];

export function getFeriado(dataStr: string): Feriado | null {
  return FERIADOS_2026.find(f => f.data === dataStr) || null;
}

export function isFeriado(dataStr: string): boolean {
  return FERIADOS_2026.some(f => f.data === dataStr);
}
