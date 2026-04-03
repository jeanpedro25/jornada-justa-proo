/**
 * Cálculo de INSS (tabela progressiva 2024/2025) e IRRF para estimativa de salário líquido.
 * Valores atualizados conforme legislação vigente.
 * ATENÇÃO: São estimativas. Valores reais dependem de convenção coletiva e holerite oficial.
 */

// Tabela progressiva INSS 2024/2025
const FAIXAS_INSS = [
  { teto: 1518.00, aliquota: 0.075 },
  { teto: 2793.88, aliquota: 0.09 },
  { teto: 4190.83, aliquota: 0.12 },
  { teto: 8157.41, aliquota: 0.14 },
];

export function calcularINSS(bruto: number): number {
  let desconto = 0;
  let anterior = 0;

  for (const faixa of FAIXAS_INSS) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, faixa.teto) - anterior;
    if (base > 0) {
      desconto += base * faixa.aliquota;
    }
    anterior = faixa.teto;
  }

  return Math.round(desconto * 100) / 100;
}

// Tabela IRRF 2024/2025
const FAIXAS_IRRF = [
  { teto: 2259.20, aliquota: 0, deduzir: 0 },
  { teto: 2826.65, aliquota: 0.075, deduzir: 169.44 },
  { teto: 3751.05, aliquota: 0.15, deduzir: 381.44 },
  { teto: 4664.68, aliquota: 0.225, deduzir: 662.77 },
  { teto: Infinity, aliquota: 0.275, deduzir: 896.00 },
];

export function calcularIRRF(bruto: number, inss: number): number {
  const base = bruto - inss;
  if (base <= 0) return 0;

  for (const faixa of FAIXAS_IRRF) {
    if (base <= faixa.teto) {
      const imposto = base * faixa.aliquota - faixa.deduzir;
      return Math.max(0, Math.round(imposto * 100) / 100);
    }
  }
  return 0;
}

export interface ResumoLiquido {
  bruto: number;
  inss: number;
  irrf: number;
  descontosFixos: number;
  liquido: number;
}

export function calcularLiquido(bruto: number, descontosFixos = 0): ResumoLiquido {
  const inss = calcularINSS(bruto);
  const irrf = calcularIRRF(bruto, inss);
  const liquido = Math.max(0, bruto - inss - irrf - descontosFixos);
  return { bruto, inss, irrf, descontosFixos, liquido };
}
