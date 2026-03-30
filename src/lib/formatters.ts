export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDatePtBR = (date: Date) => {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dias[date.getDay()]}, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
};

export const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const now = new Date();
  return `${meses[now.getMonth()]} ${now.getFullYear()}`;
};
