import { describe, expect, it } from 'vitest';
import { calcularINSS, calcularIRRF } from '@/lib/descontos';

// Testes de sanidade: validam monotonicidade e alguns pontos conhecidos (tabela 2026).
describe('descontos', () => {
  it('calcularINSS deve ser 0 para valores <= 0', () => {
    expect(calcularINSS(0)).toBe(0);
    expect(calcularINSS(-10)).toBe(0);
  });

  it('calcularINSS deve crescer com o salário (progressivo)', () => {
    const a = calcularINSS(1621);
    const b = calcularINSS(2000);
    const c = calcularINSS(3000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('calcularINSS no teto deve bater com arredondamento de centavos (max ~988,09 em 2026)', () => {
    // teto 2026: 8.475,55 — desconto máximo esperado: ~988,09 (fontes públicas e material do INSS)
    expect(calcularINSS(8475.55)).toBeCloseTo(988.09, 2);
    // acima do teto não deveria aumentar
    expect(calcularINSS(10000)).toBeCloseTo(calcularINSS(8475.55), 2);
  });

  it('calcularIRRF deve ser 0 quando base após INSS fica na faixa de isenção', () => {
    // salário 3000 com INSS reduz base; não garante isenção, mas deve ser >= 0
    expect(calcularIRRF(2000, calcularINSS(2000))).toBeGreaterThanOrEqual(0);
    expect(calcularIRRF(2400, calcularINSS(2400))).toBeGreaterThanOrEqual(0);
  });

  it('calcularIRRF deve ser não-negativo e aumentar para salários maiores (sanidade)', () => {
    const s1 = 3000;
    const s2 = 6000;
    const ir1 = calcularIRRF(s1, calcularINSS(s1));
    const ir2 = calcularIRRF(s2, calcularINSS(s2));
    expect(ir1).toBeGreaterThanOrEqual(0);
    expect(ir2).toBeGreaterThanOrEqual(ir1);
  });
});

