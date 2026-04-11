/**
 * Cálculo de INSS e IRRF (tabelas vigentes) para estimativa de salário líquido.
 * ATENÇÃO: São estimativas. Valores reais dependem de regras do empregador, convenção coletiva e holerite oficial.
 */

// Tabela progressiva INSS 2026 (empregado/avulso/doméstico) — aplicada por faixas (progressiva)
const FAIXAS_INSS = [
  { teto: 1621.00, aliquota: 0.075 },
  { teto: 2902.84, aliquota: 0.09 },
  { teto: 4354.27, aliquota: 0.12 },
  { teto: 8475.55, aliquota: 0.14 },
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

// Tabela IRRF mensal 2026 (base após INSS)
const FAIXAS_IRRF = [
  { teto: 2428.80, aliquota: 0, deduzir: 0 },
  { teto: 2826.65, aliquota: 0.075, deduzir: 182.16 },
  { teto: 3751.05, aliquota: 0.15, deduzir: 394.16 },
  { teto: 4664.68, aliquota: 0.225, deduzir: 675.49 },
  { teto: Infinity, aliquota: 0.275, deduzir: 908.73 },
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

/** Dedução por dependente — IRRF mensal (valor vigente em 2026) */
const DEDUCAO_DEPENDENTE_IRRF = 189.59;

/**
 * IRRF sobre base já descontada do INSS, com abatimento por dependentes (dedução legal por dependente).
 */
export function calcularIRRFFixaComDependentes(baseAposInss: number, dependentes: number): number {
  const dep = Math.max(0, Math.min(dependentes, 99));
  const base = Math.max(0, baseAposInss - dep * DEDUCAO_DEPENDENTE_IRRF);
  for (const faixa of FAIXAS_IRRF) {
    if (base <= faixa.teto) {
      const imposto = base * faixa.aliquota - faixa.deduzir;
      return Math.max(0, Math.round(imposto * 100) / 100);
    }
  }
  return 0;
}

export interface DescontosDetalhados {
  planoSaude: number;
  adiantamentos: number;
  outrosDescontos: number;
}

export interface BeneficiosEntrada {
  valeAlimentacao: number;
  auxilioCombustivel: number;
  bonificacoes: number;
}

export interface ResumoLiquido {
  bruto: number;
  inss: number;
  irrf: number;
  descontosFixos: number;
  descontosDetalhados: DescontosDetalhados;
  beneficios: BeneficiosEntrada;
  totalBeneficios: number;
  totalDescontos: number;
  liquido: number;
}

export function calcularLiquido(
  bruto: number,
  descontosFixos = 0,
  beneficios: BeneficiosEntrada = { valeAlimentacao: 0, auxilioCombustivel: 0, bonificacoes: 0 },
  descontosDetalhados: DescontosDetalhados = { planoSaude: 0, adiantamentos: 0, outrosDescontos: 0 },
): ResumoLiquido {
  const inss = calcularINSS(bruto);
  const irrf = calcularIRRF(bruto, inss);
  const totalBeneficios = beneficios.valeAlimentacao + beneficios.auxilioCombustivel + beneficios.bonificacoes;
  const totalDescontosExtra = descontosDetalhados.planoSaude + descontosDetalhados.adiantamentos + descontosDetalhados.outrosDescontos;
  const totalDescontos = inss + irrf + descontosFixos + totalDescontosExtra;
  const liquido = Math.max(0, bruto + totalBeneficios - totalDescontos);
  return {
    bruto, inss, irrf, descontosFixos,
    descontosDetalhados, beneficios,
    totalBeneficios, totalDescontos, liquido,
  };
}
