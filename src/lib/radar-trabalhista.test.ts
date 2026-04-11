import { describe, expect, it } from 'vitest';
import { analisarRadarTrabalhista } from '@/lib/radar-trabalhista';

describe('radar-trabalhista', () => {
  it('deve ignorar dias reconstituídos quando excluirReconstituidos=true', () => {
    const days = [
      // reconstituído com extra grande: não deve contar
      { data: '2026-04-01', totalMin: 12 * 60, extraMin: 4 * 60, intervaloMin: 60, origem: 'real', ehDiaTrabalho: true, registroOrigem: 'reconstituido' },
      // real com extra grande: deve contar
      { data: '2026-04-02', totalMin: 12 * 60, extraMin: 4 * 60, intervaloMin: 60, origem: 'real', ehDiaTrabalho: true, registroOrigem: 'real' },
    ];

    const alertas = analisarRadarTrabalhista({
      days,
      bancoSaldoMin: 0,
      bancoDataPrimeiro: null,
      salario: 3000,
      percentualHE: 50,
      cargaHoras: 8,
      excluirReconstituidos: true,
    });

    // Deve encontrar pelo menos o alerta de extras excessivas por causa do dia real.
    expect(alertas.some(a => a.id === 'extras_excessivas')).toBe(true);
  });

  it('deve gerar alerta de sequência quando houver muitos dias consecutivos', () => {
    const days: any[] = [];
    // 12 dias corridos trabalhados
    for (let i = 1; i <= 12; i++) {
      const d = `2026-04-${String(i).padStart(2, '0')}`;
      days.push({ data: d, totalMin: 8 * 60, extraMin: 0, intervaloMin: 60, origem: 'real', ehDiaTrabalho: true, registroOrigem: 'real' });
    }

    const alertas = analisarRadarTrabalhista({
      days,
      bancoSaldoMin: 0,
      bancoDataPrimeiro: null,
      salario: 3000,
      percentualHE: 50,
      cargaHoras: 8,
      excluirReconstituidos: true,
    });

    expect(alertas.some(a => a.id === 'sequencia_dias_labor')).toBe(true);
  });
});

