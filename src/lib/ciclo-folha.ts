/**
 * Ciclo de Fechamento de Folha — Hora Justa
 * 
 * Se dia_fechamento_folha = 0 → mês civil normal (dia 1 a último dia).
 * Se dia_fechamento_folha = 20 → ciclo vai de dia 21 do mês anterior até dia 20 do mês atual.
 */

export interface CicloFolha {
  inicio: Date;
  fim: Date;
  label: string;
}

/**
 * Retorna o ciclo de folha vigente para uma data de referência.
 * @param diaFechamento 0 = mês civil, 1-28 = dia de corte
 * @param referencia data de referência (default: hoje)
 */
export function getCicloAtual(diaFechamento: number, referencia: Date = new Date()): CicloFolha {
  if (!diaFechamento || diaFechamento <= 0) {
    // Mês civil
    const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
    const mesLabel = referencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { inicio, fim, label: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1) };
  }

  const dia = Math.min(diaFechamento, 28);
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();

  // Data de fechamento do mês atual
  const fechamentoEsteMes = new Date(ano, mes, dia);

  let inicio: Date;
  let fim: Date;

  if (referencia.getDate() <= dia) {
    // Estamos antes ou no dia de fechamento → ciclo é do mês anterior+1 até este mês
    fim = new Date(ano, mes, dia);
    inicio = new Date(ano, mes - 1, dia + 1);
  } else {
    // Já passamos o fechamento → ciclo é deste mês+1 até próximo mês
    inicio = new Date(ano, mes, dia + 1);
    fim = new Date(ano, mes + 1, dia);
  }

  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const label = `Ciclo ${formatDate(inicio)} a ${formatDate(fim)}`;

  return { inicio, fim, label };
}

/**
 * Retorna início e fim do ciclo como strings "YYYY-MM-DD" para queries.
 */
export function getCicloQuery(diaFechamento: number, referencia?: Date): { start: string; end: string; label: string } {
  const ciclo = getCicloAtual(diaFechamento, referencia);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { start: fmt(ciclo.inicio), end: fmt(ciclo.fim), label: ciclo.label };
}
