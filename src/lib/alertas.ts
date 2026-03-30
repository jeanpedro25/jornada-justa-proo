import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

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
      mensagem: `Você trabalhou ${horasTrabalhadas.toFixed(1)}h hoje. Jornada acima de 10h é irregular pela CLT.`,
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

  if (alertas.length > 0) {
    await supabase.from('alertas').insert(alertas);
  }
}
