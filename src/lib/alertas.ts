import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { fetchBancoHorasEntries, summarizeBancoHoras } from '@/lib/banco-horas';

type Registro = Tables<'registros_ponto'>;
type Profile = Tables<'profiles'>;

export async function gerarAlertas(registro: Registro, perfil: Profile) {
  const entrada = new Date(registro.entrada).getTime();
  const saida = registro.saida ? new Date(registro.saida).getTime() : Date.now();
  const duracaoMin = (saida - entrada) / 60000;
  const intervalo = registro.intervalo_minutos ?? 60;
  const horasTrabalhadas = (duracaoMin - intervalo) / 60;
  const carga = perfil.carga_horaria_diaria ?? 8;
  const horaExtra = Math.max(0, horasTrabalhadas - carga);
  const alertas: Array<{ tipo: string; mensagem: string; user_id: string; registro_id: string }> = [];

  if (intervalo < 60 && duracaoMin > 360) {
    alertas.push({
      tipo: 'sem_intervalo',
      mensagem: 'Você trabalhou mais de 6h sem intervalo adequado. A CLT exige pausa mínima de 1h.',
      user_id: perfil.id,
      registro_id: registro.id,
    });
  }

  if (intervalo < 15 && intervalo > 0 && duracaoMin > 240) {
    alertas.push({
      tipo: 'intervalo_curto',
      mensagem: `Seu intervalo foi de apenas ${intervalo}min. A CLT exige mínimo de 15min para jornadas acima de 4h.`,
      user_id: perfil.id,
      registro_id: registro.id,
    });
  }

  if (horasTrabalhadas > 10) {
    alertas.push({
      tipo: 'jornada_excessiva',
      mensagem: `Você trabalhou ${horasTrabalhadas.toFixed(2)}h hoje. Jornada acima de 10h é irregular pela CLT.`,
      user_id: perfil.id,
      registro_id: registro.id,
    });
  }

  if (horaExtra > 0) {
    alertas.push({
      tipo: 'hora_extra',
      mensagem: `Você fez ${Math.floor(horaExtra)}h ${Math.round((horaExtra % 1) * 60)}min de hora extra hoje. Registro salvo como prova.`,
      user_id: perfil.id,
      registro_id: registro.id,
    });
  }

  // Banco de horas alerts
  const p = perfil as any;
  if (p.modo_trabalho === 'banco_horas') {
    try {
      const entries = await fetchBancoHorasEntries(perfil.id);
      const summary = summarizeBancoHoras(entries, perfil.salario_base ?? 0, perfil.hora_extra_percentual ?? 50);

      if (summary.expirandoEm10Dias > 0) {
        alertas.push({
          tipo: 'banco_horas_vencendo',
          mensagem: `Você tem horas próximas de vencer no banco de horas. Compense antes que expirem!`,
          user_id: perfil.id,
          registro_id: registro.id,
        });
      }

      if (summary.saldo > 40 * 60) {
        alertas.push({
          tipo: 'banco_horas_alto',
          mensagem: `Seu banco de horas está alto (${Math.round(summary.saldo / 60)}h). Considere compensar.`,
          user_id: perfil.id,
          registro_id: registro.id,
        });
      }

      if (summary.expirado > 0) {
        alertas.push({
          tipo: 'banco_horas_perdido',
          mensagem: `Você pode estar perdendo horas! ${Math.round(summary.expirado / 60)}h venceram sem compensação.`,
          user_id: perfil.id,
          registro_id: registro.id,
        });
      }
    } catch {}
  }

  if (alertas.length > 0) {
    await supabase.from('alertas').insert(alertas);
  }
}
