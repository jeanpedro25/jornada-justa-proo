import { supabase } from '@/integrations/supabase/client';

export type ModoTrabalho = 'horas_extras' | 'banco_horas';
export type RegraConversao = '1x' | '1.5x' | '2x';
export type TipoEntrada = 'acumulo' | 'compensacao';

export interface BancoHorasConfig {
  modoTrabalho: ModoTrabalho;
  prazoCompensacaoDias: number;
  regraConversao: RegraConversao;
  limiteBancoHoras: number | null; // in minutes
}

export interface BancoHorasEntry {
  id: string;
  user_id: string;
  data: string;
  tipo: TipoEntrada;
  minutos: number;
  expira_em: string;
  nota: string | null;
  registro_id: string | null;
  created_at: string;
}

export interface BancoHorasSummary {
  saldo: number; // minutes
  aCompensar: number; // minutes (negative entries)
  expirandoEm10Dias: number; // minutes
  expirado: number; // minutes
  estimativaValor: number; // R$
}

const multiplicador = (conv: RegraConversao): number => {
  if (conv === '1x') return 1;
  if (conv === '1.5x') return 1.5;
  return 2;
};

export function calcularEntradaBancoHoras(
  userId: string,
  data: string,
  diffMinutos: number, // positive = worked more, negative = worked less
  config: BancoHorasConfig,
  registroId?: string,
): Omit<BancoHorasEntry, 'id' | 'created_at'> | null {
  if (config.modoTrabalho !== 'banco_horas' || diffMinutos === 0) return null;

  const expDate = new Date(data);
  expDate.setDate(expDate.getDate() + config.prazoCompensacaoDias);

  const tipo: TipoEntrada = diffMinutos > 0 ? 'acumulo' : 'compensacao';
  const minutos = Math.round(Math.abs(diffMinutos) * (tipo === 'acumulo' ? multiplicador(config.regraConversao) : 1));

  return {
    user_id: userId,
    data,
    tipo,
    minutos,
    expira_em: expDate.toISOString(),
    nota: null,
    registro_id: registroId || null,
  };
}

export function summarizeBancoHoras(
  entries: BancoHorasEntry[],
  salarioBase: number,
  percentualExtra: number,
  now = new Date(),
): BancoHorasSummary {
  const nowTs = now.getTime();
  const em10dias = nowTs + 10 * 24 * 60 * 60 * 1000;

  let saldo = 0;
  let aCompensar = 0;
  let expirandoEm10Dias = 0;
  let expirado = 0;

  entries.forEach(e => {
    const expTs = new Date(e.expira_em).getTime();

    if (e.tipo === 'acumulo') {
      if (expTs < nowTs) {
        expirado += e.minutos;
      } else {
        saldo += e.minutos;
        if (expTs <= em10dias) {
          expirandoEm10Dias += e.minutos;
        }
      }
    } else {
      saldo -= e.minutos;
      aCompensar += e.minutos;
    }
  });

  const valorHoraNormal = salarioBase / 220;
  const valorHE = valorHoraNormal * (1 + percentualExtra / 100);
  const estimativaValor = (saldo / 60) * valorHE;

  return { saldo, aCompensar, expirandoEm10Dias, expirado, estimativaValor };
}

export async function fetchBancoHorasEntries(userId: string): Promise<BancoHorasEntry[]> {
  const { data } = await supabase
    .from('banco_horas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: true }) as any;
  return data || [];
}

export async function insertBancoHorasEntry(entry: Omit<BancoHorasEntry, 'id' | 'created_at'>) {
  return supabase.from('banco_horas').insert(entry as any);
}

export async function marcarFolgaBancoHoras(
  userId: string,
  data: string,
  minutosDescontar: number,
  nota: string,
  prazoCompensacaoDias: number,
) {
  const expDate = new Date(data);
  expDate.setDate(expDate.getDate() + prazoCompensacaoDias);

  return supabase.from('banco_horas').insert({
    user_id: userId,
    data,
    tipo: 'compensacao',
    minutos: minutosDescontar,
    expira_em: expDate.toISOString(),
    nota,
  } as any);
}

export function formatMinutosHoras(minutos: number): string {
  const h = Math.floor(Math.abs(minutos) / 60);
  const m = Math.round(Math.abs(minutos) % 60);
  const sign = minutos >= 0 ? '+' : '-';
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${m}min`;
}
