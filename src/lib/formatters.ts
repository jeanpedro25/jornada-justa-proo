import { fusoLocal } from '@/lib/dataHora';

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDatePtBR = (date: Date) => {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: fusoLocal,
  });
};

export const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fusoLocal });

export const diaSemanaAbrev = (date: Date) => {
  const abrevs = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return abrevs[date.getDay()];
};

export const formatTimer = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const calcHorasTrabalhadas = (entrada: string, saida: string | null, intervaloMin: number) => {
  if (!saida) return 0;
  const diff = (new Date(saida).getTime() - new Date(entrada).getTime()) / 60000;
  return Math.max(0, (diff - intervaloMin) / 60);
};

export const calcHoraExtra = (horasTrabalhadas: number, cargaDiaria: number) =>
  Math.max(0, horasTrabalhadas - cargaDiaria);

export const calcValorHoraExtra = (salarioBase: number, percentual: number) => {
  const valorHoraNormal = salarioBase / 220;
  return valorHoraNormal * (1 + percentual / 100);
};

export const mesAnoAtual = () => {
  const now = new Date();
  return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: fusoLocal })
    .replace(/^./, s => s.toUpperCase());
};
