// Sistema inteligente de feriados brasileiros
// Calcula feriados fixos + móveis para qualquer ano

export interface Feriado {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'nacional' | 'local';
}

// Algoritmo de Meeus/Jones/Butcher para calcular Páscoa
function calcularPascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function dateStr(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function addDays(ano: number, mes: number, dia: number, dias: number): string {
  const d = new Date(ano, mes - 1, dia + dias);
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function getFeriadosNacionais(ano: number): Feriado[] {
  const pascoa = calcularPascoa(ano);
  const pascoaStr = dateStr(ano, pascoa.mes, pascoa.dia);

  // Feriados móveis (baseados na Páscoa)
  const carnavalSeg = addDays(ano, pascoa.mes, pascoa.dia, -48);
  const carnavalTer = addDays(ano, pascoa.mes, pascoa.dia, -47);
  const sextaSanta = addDays(ano, pascoa.mes, pascoa.dia, -2);
  const corpusChristi = addDays(ano, pascoa.mes, pascoa.dia, 60);

  return [
    { data: dateStr(ano, 1, 1), nome: 'Confraternização Universal', tipo: 'nacional' },
    { data: carnavalSeg, nome: 'Carnaval', tipo: 'nacional' },
    { data: carnavalTer, nome: 'Carnaval', tipo: 'nacional' },
    { data: sextaSanta, nome: 'Sexta-feira Santa', tipo: 'nacional' },
    { data: pascoaStr, nome: 'Páscoa', tipo: 'nacional' },
    { data: dateStr(ano, 4, 21), nome: 'Tiradentes', tipo: 'nacional' },
    { data: dateStr(ano, 5, 1), nome: 'Dia do Trabalho', tipo: 'nacional' },
    { data: corpusChristi, nome: 'Corpus Christi', tipo: 'nacional' },
    { data: dateStr(ano, 9, 7), nome: 'Independência do Brasil', tipo: 'nacional' },
    { data: dateStr(ano, 10, 12), nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
    { data: dateStr(ano, 11, 2), nome: 'Finados', tipo: 'nacional' },
    { data: dateStr(ano, 11, 15), nome: 'Proclamação da República', tipo: 'nacional' },
    { data: dateStr(ano, 11, 20), nome: 'Consciência Negra', tipo: 'nacional' },
    { data: dateStr(ano, 12, 25), nome: 'Natal', tipo: 'nacional' },
  ];
}

// Cache por ano
const cache = new Map<number, Feriado[]>();

export function getFeriadosDoAno(ano: number): Feriado[] {
  if (!cache.has(ano)) {
    cache.set(ano, getFeriadosNacionais(ano));
  }
  return cache.get(ano)!;
}

export function getFeriado(dataStr: string): Feriado | null {
  const ano = parseInt(dataStr.substring(0, 4), 10);
  if (isNaN(ano)) return null;
  return getFeriadosDoAno(ano).find(f => f.data === dataStr) || null;
}

export function isFeriado(dataStr: string): boolean {
  return getFeriado(dataStr) !== null;
}

// Para uso com feriados locais do banco de dados
export function getFeriadoComLocais(
  dataStr: string,
  feriadosLocais: { data: string; nome: string; recorrente: boolean }[]
): Feriado | null {
  // Primeiro verifica nacionais
  const nacional = getFeriado(dataStr);
  if (nacional) return nacional;

  // Depois verifica locais
  const local = feriadosLocais.find(f => {
    if (f.recorrente) {
      // Compara só mês e dia
      return f.data.substring(5) === dataStr.substring(5);
    }
    return f.data === dataStr;
  });

  if (local) {
    return { data: dataStr, nome: local.nome, tipo: 'local' };
  }

  return null;
}
