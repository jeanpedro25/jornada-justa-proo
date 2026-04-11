/**
 * Cálculos rescisórios e FGTS — estimativas para conferência pessoal (não substitui assessoria jurídica).
 * FGTS: meses de depósito; multa conforme modalidade; aviso Lei 12.506/2011; férias + 1/3 em avos do período aquisitivo.
 */

export type TipoRescisao = 'sem_justa_causa' | 'justa_causa' | 'pedido_demissao' | 'comum_acordo';

/** Meses com depósito de FGTS (do mês da admissão ao mês da rescisão, inclusive). */
export function mesesFGTSCalendario(admissao: Date, rescisao: Date): number {
  const yi = admissao.getFullYear();
  const mi = admissao.getMonth();
  const yf = rescisao.getFullYear();
  const mf = rescisao.getMonth();
  const raw = (yf - yi) * 12 + (mf - mi) + 1;
  return Math.max(0, raw);
}

/** Anos completos de serviço (para aviso prévio: +3 dias por ano completo, Lei 12.506/2011). */
export function anosCompletosServico(admissao: Date, rescisao: Date): number {
  let anos = rescisao.getFullYear() - admissao.getFullYear();
  const ma = admissao.getMonth();
  const da = admissao.getDate();
  const mr = rescisao.getMonth();
  const dr = rescisao.getDate();
  if (mr < ma || (mr === ma && dr < da)) anos -= 1;
  return Math.max(0, anos);
}

/** Dias de aviso prévio (teto 90): 30 + 3 × anos completos. */
export function diasAvisoPrevio12606(anosCompletos: number): number {
  return Math.min(90, 30 + anosCompletos * 3);
}

/** Valor monetário do aviso (salário/dia × dias). Para acordo mútuo: fator 0,5 sobre o valor integral. */
export function valorAvisoPrevio(salarioMensal: number, diasAviso: number, fatorAcordo: number = 1): number {
  const valorDia = salarioMensal / 30;
  return valorDia * diasAviso * fatorAcordo;
}

/** Avos de férias no período aquisitivo em curso (máx. 12), contados a partir da última férias ou admissão. */
export function avosFeriasProporcionais(inicioPeriodoAquisitivo: Date, rescisao: Date): number {
  const y1 = inicioPeriodoAquisitivo.getFullYear();
  const m1 = inicioPeriodoAquisitivo.getMonth();
  const d1 = inicioPeriodoAquisitivo.getDate();
  const y2 = rescisao.getFullYear();
  const m2 = rescisao.getMonth();
  const d2 = rescisao.getDate();
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  const avos = meses + 1;
  return Math.min(12, Math.max(0, avos));
}

/** 13º proporcional: avos no ano-calendário da rescisão (1–12). */
export function avos13SalarioNoAno(admissao: Date, rescisao: Date): number {
  const ano = rescisao.getFullYear();
  const inicioAno = new Date(ano, 0, 1);
  const inicio = admissao > inicioAno ? admissao : inicioAno;
  const y1 = inicio.getFullYear();
  const m1 = inicio.getMonth();
  const d1 = inicio.getDate();
  const y2 = rescisao.getFullYear();
  const m2 = rescisao.getMonth();
  const d2 = rescisao.getDate();
  let meses = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.min(12, Math.max(0, meses + 1));
}

export function valor13Proporcional(salario: number, avos: number): number {
  return (salario / 12) * avos;
}

/** Férias proporcionais + 1/3 constitucional. */
export function valorFeriasMaisTerco(salario: number, avos: number): number {
  const prop = (salario / 12) * avos;
  return prop * (4 / 3);
}

export function saldoSalarioMes(salario: number, dataRescisao: Date): number {
  const diasNoMes = new Date(dataRescisao.getFullYear(), dataRescisao.getMonth() + 1, 0).getDate();
  const diasTrab = dataRescisao.getDate();
  return (salario / diasNoMes) * diasTrab;
}

/** FGTS estimado se não informado manualmente: 8% × salário × meses. */
export function fgtsEstimado(salario: number, meses: number): number {
  return salario * 0.08 * meses;
}

export function multaFgtsPercentual(tipo: TipoRescisao): number {
  if (tipo === 'sem_justa_causa') return 0.4;
  if (tipo === 'comum_acordo') return 0.2;
  return 0;
}
