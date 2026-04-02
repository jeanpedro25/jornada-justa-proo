import { supabase } from '@/integrations/supabase/client';
import {
  buscarMarcacoesDia,
  calcularJornada,
  getCargaDiaria,
  type JornadaDia,
  type Marcacao,
  type TipoMarcacao,
} from '@/lib/jornada';
import {
  calcularEntradaBancoHoras,
  insertBancoHorasEntry,
  type BancoHorasConfig,
} from '@/lib/banco-horas';

interface PerfilResumoDia {
  modo_trabalho?: string | null;
  prazo_compensacao_dias?: number | null;
  regra_conversao?: string | null;
  limite_banco_horas?: number | null;
  tipo_jornada?: string | null;
  escala_tipo?: string | null;
  carga_horaria_diaria?: number | null;
}

export interface MarcacaoManualPayload {
  tipo: TipoMarcacao;
  horario: string;
}

const entradaPlaceholder = (data: string) => new Date(`${data}T00:00:00`).toISOString();

async function buscarRegistroDia(userId: string, data: string) {
  const { data: rows, error } = await supabase
    .from('registros_ponto')
    .select('*')
    .eq('user_id', userId)
    .eq('data', data)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return (rows as any[])?.[0] ?? null;
}

async function salvarRegistroDia(
  userId: string,
  data: string,
  patch: Record<string, any>,
  existing?: any | null,
) {
  if (existing) {
    const { data: updated, error } = await supabase
      .from('registros_ponto')
      .update(patch as any)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return updated;
  }

  const payload = {
    user_id: userId,
    data,
    entrada: typeof patch.entrada === 'string' && patch.entrada ? patch.entrada : entradaPlaceholder(data),
    ...patch,
  };

  const { data: created, error } = await supabase
    .from('registros_ponto')
    .insert(payload as any)
    .select('*')
    .single();

  if (error) throw error;
  return created;
}

export async function garantirRegistroDia(
  userId: string,
  data: string,
  patch: Record<string, any> = {},
) {
  const existing = await buscarRegistroDia(userId, data);
  return salvarRegistroDia(userId, data, patch, existing);
}

async function recalcularBancoHorasDia(
  userId: string,
  data: string,
  registroId: string,
  marcacoes: Marcacao[],
  jornada: JornadaDia,
  perfil?: PerfilResumoDia | null,
) {
  if (!perfil || perfil.modo_trabalho !== 'banco_horas') return;

  const { error: deleteError } = await supabase
    .from('banco_horas')
    .delete()
    .eq('user_id', userId)
    .eq('data', data)
    .is('nota', null);

  if (deleteError) throw deleteError;

  const jornadaEncerrada = marcacoes.some((m) => m.tipo === 'saida_final');
  if (!jornadaEncerrada || jornada.totalTrabalhado <= 0) return;

  const cargaDiaria = getCargaDiaria(
    (perfil.tipo_jornada || 'jornada_fixa') as any,
    perfil.escala_tipo || null,
    Number(perfil.carga_horaria_diaria ?? 8),
  );

  const regraConversao = perfil.regra_conversao;
  const config: BancoHorasConfig = {
    modoTrabalho: 'banco_horas',
    prazoCompensacaoDias: perfil.prazo_compensacao_dias ?? 180,
    regraConversao: regraConversao === '1x' || regraConversao === '2x' ? regraConversao : '1.5x',
    limiteBancoHoras: perfil.limite_banco_horas ?? null,
  };

  const diff = jornada.totalTrabalhado - cargaDiaria * 60;
  const entry = calcularEntradaBancoHoras(userId, data, diff, config, registroId);

  if (!entry) return;

  const { error: insertError } = await insertBancoHorasEntry(entry);
  if (insertError) throw insertError;
}

export async function sincronizarRegistroDia(
  userId: string,
  data: string,
  perfil?: PerfilResumoDia | null,
  editadoPor?: string | null,
) {
  const [marcacoes, existing] = await Promise.all([
    buscarMarcacoesDia(userId, data),
    buscarRegistroDia(userId, data),
  ]);

  if (marcacoes.length === 0 && !existing) {
    await recalcularBancoHorasDia(userId, data, '', marcacoes, {
      periodos: [],
      intervalos: [],
      totalTrabalhado: 0,
      totalIntervalo: 0,
      emAndamento: false,
      primeiraEntrada: null,
      ultimaSaida: null,
    }, perfil);
    return { registro: null, marcacoes, jornada: null };
  }

  const jornada = calcularJornada(marcacoes);
  const patch: Record<string, any> = {
    entrada: marcacoes[0]?.horario || existing?.entrada || entradaPlaceholder(data),
    saida: marcacoes.filter((m) => m.tipo === 'saida_final').at(-1)?.horario || null,
    intervalo_minutos: jornada.totalIntervalo,
  };

  if (editadoPor) {
    patch.editado_manualmente = true;
    patch.editado_em = new Date().toISOString();
    patch.editado_por = editadoPor;
  }

  const registro = await salvarRegistroDia(userId, data, patch, existing);
  await recalcularBancoHorasDia(userId, data, registro.id, marcacoes, jornada, perfil);

  return { registro, marcacoes, jornada };
}

export async function substituirMarcacoesDiaManual(
  userId: string,
  data: string,
  marcacoes: MarcacaoManualPayload[],
  perfil?: PerfilResumoDia | null,
) {
  const now = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from('marcacoes_ponto')
    .update({ deleted_at: now } as any)
    .eq('user_id', userId)
    .eq('data', data)
    .is('deleted_at', null);

  if (deleteError) throw deleteError;

  const rows = [...marcacoes]
    .sort((a, b) => new Date(a.horario).getTime() - new Date(b.horario).getTime())
    .map((marcacao) => ({
      user_id: userId,
      data,
      tipo: marcacao.tipo,
      horario: marcacao.horario,
      origem: 'manual',
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('marcacoes_ponto')
      .insert(rows as any);

    if (insertError) throw insertError;
  }

  return sincronizarRegistroDia(userId, data, perfil, userId);
}
