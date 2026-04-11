import { describe, expect, it } from 'vitest';
import { calcularJornada, type Marcacao } from '@/lib/jornada';

function m(data: string, tipo: Marcacao['tipo'], horarioIso: string): Marcacao {
  return {
    id: `${data}-${tipo}-${horarioIso}`,
    user_id: 'u',
    data,
    tipo,
    horario: horarioIso,
    origem: 'botao',
    deleted_at: null,
    created_at: horarioIso,
  };
}

describe('calcularJornada', () => {
  it('sem marcações deve retornar zeros', () => {
    const j = calcularJornada([], 8 * 60);
    expect(j.totalTrabalhado).toBe(0);
    expect(j.totalIntervalo).toBe(0);
    expect(j.horaExtraMin).toBe(0);
    expect(j.devendoMin).toBe(8 * 60);
  });

  it('entrada + saída final computa total trabalhado e hora extra vs carga', () => {
    const data = '2026-04-01';
    const marcacoes: Marcacao[] = [
      m(data, 'entrada', `${data}T08:00:00.000Z`),
      m(data, 'saida_final', `${data}T18:00:00.000Z`),
    ];
    const j = calcularJornada(marcacoes, 8 * 60);
    expect(j.totalTrabalhado).toBe(10 * 60);
    expect(j.horaExtraMin).toBe(2 * 60);
    expect(j.devendoMin).toBe(0);
  });

  it('intervalo é computado separadamente e não reduz totalTrabalhado (regra atual)', () => {
    const data = '2026-04-02';
    const marcacoes: Marcacao[] = [
      m(data, 'entrada', `${data}T08:00:00.000Z`),
      m(data, 'saida_intervalo', `${data}T12:00:00.000Z`),
      m(data, 'volta_intervalo', `${data}T13:00:00.000Z`),
      m(data, 'saida_final', `${data}T18:00:00.000Z`),
    ];
    const j = calcularJornada(marcacoes, 8 * 60);
    expect(j.totalIntervalo).toBe(60);
    expect(j.totalTrabalhado).toBe((4 + 5) * 60);
    expect(j.horaExtraMin).toBe(60);
  });
});

