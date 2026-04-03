import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { month, year } = await req.json();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Fetch marcacoes_ponto (the actual data source)
    const { data: marcacoes } = await supabase
      .from("marcacoes_ponto")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("data", startDate)
      .lt("data", endDate)
      .order("horario", { ascending: true });

    // Fetch banco_horas entries
    const { data: bancoEntries } = await supabase
      .from("banco_horas")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: true });

    const carga = profile?.carga_horaria_diaria ?? 8;
    const salario = profile?.salario_base ?? 0;
    const percentual = profile?.hora_extra_percentual ?? 50;
    const saldoInicial = profile?.banco_horas_saldo_inicial ?? 0;

    // Group marcacoes by day and calculate
    const dayMap: Record<string, any[]> = {};
    (marcacoes || []).forEach((m: any) => {
      if (!dayMap[m.data]) dayMap[m.data] = [];
      dayMap[m.data].push(m);
    });

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let totalMinTrab = 0;
    let totalMinExtra = 0;

    // Simple jornada calculator for edge function
    function calcJornada(marks: any[]) {
      let totalTrab = 0;
      let totalInt = 0;
      let inicioAtual: string | null = null;
      let saidaIntervalo: string | null = null;
      let primeiraEntrada: string | null = null;
      let ultimaSaida: string | null = null;

      for (const m of marks) {
        if (m.tipo === 'entrada' || m.tipo === 'volta_intervalo') {
          if (m.tipo === 'volta_intervalo' && saidaIntervalo) {
            totalInt += Math.max(0, (new Date(m.horario).getTime() - new Date(saidaIntervalo).getTime()) / 60000);
            saidaIntervalo = null;
          }
          inicioAtual = m.horario;
          if (m.tipo === 'entrada' && !primeiraEntrada) primeiraEntrada = m.horario;
        }
        if (m.tipo === 'saida_intervalo' && inicioAtual) {
          totalTrab += Math.max(0, (new Date(m.horario).getTime() - new Date(inicioAtual).getTime()) / 60000);
          saidaIntervalo = m.horario;
          inicioAtual = null;
        }
        if (m.tipo === 'saida_final') {
          if (inicioAtual) {
            totalTrab += Math.max(0, (new Date(m.horario).getTime() - new Date(inicioAtual).getTime()) / 60000);
          }
          ultimaSaida = m.horario;
          inicioAtual = null;
          saidaIntervalo = null;
        }
      }

      return { totalTrab: Math.round(totalTrab), totalInt: Math.round(totalInt), primeiraEntrada, ultimaSaida };
    }

    const rows = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, marks]) => {
        const j = calcJornada(marks);
        const extraMin = Math.max(0, j.totalTrab - carga * 60);
        totalMinTrab += j.totalTrab;
        totalMinExtra += extraMin;

        const dateStr = new Date(data + 'T12:00:00');
        return {
          data: dateStr.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          diaSemana: diasSemana[dateStr.getDay()],
          entrada: j.primeiraEntrada
            ? new Date(j.primeiraEntrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
            : '—',
          saida: j.ultimaSaida
            ? new Date(j.ultimaSaida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
            : '—',
          intervalo: j.totalInt > 0 ? `${j.totalInt}min` : '—',
          horasTrab: `${Math.floor(j.totalTrab / 60)}h${j.totalTrab % 60}min`,
          horaExtra: extraMin > 0 ? `+${Math.floor(extraMin / 60)}h${extraMin % 60}min` : '—',
          marcacoes: marks.length,
        };
      });

    const valorHN = salario / 220;
    const valorHE = valorHN * (1 + percentual / 100);
    const valorTotal = (totalMinExtra / 60) * valorHE;

    // Banco de horas summary
    let bhSaldo = saldoInicial;
    (bancoEntries || []).forEach((e: any) => {
      if (e.tipo === 'acumulo') {
        const exp = new Date(e.expira_em).getTime();
        if (exp >= Date.now()) bhSaldo += e.minutos;
      } else {
        bhSaldo -= e.minutos;
      }
    });

    const fmtMin = (m: number) => {
      const sign = m >= 0 ? '+' : '-';
      const h = Math.floor(Math.abs(m) / 60);
      const min = Math.round(Math.abs(m) % 60);
      return `${sign}${h}h${min > 0 ? min + 'min' : ''}`;
    };

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; font-size: 12px; }
  h1 { color: #1a1a2e; font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
  .summary { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary-item { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; flex: 1; min-width: 120px; }
  .summary-item .label { font-size: 10px; color: #888; text-transform: uppercase; }
  .summary-item .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
  .accent { color: #4ECDC4; }
  .warning { color: #F39C12; }
  .success { color: #27AE60; }
  .danger { color: #E74C3C; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1a1a2e; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
  .legal { margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 10px; }
  .bh-section { margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; }
  .bh-section h3 { margin: 0 0 8px 0; font-size: 14px; color: #1a1a2e; }
  .bh-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
</style>
</head>
<body>
  <h1>⚖️ Hora Justa — Relatório de Jornada</h1>
  <p class="subtitle">${meses[month - 1]} ${year} · ${profile?.nome || 'Trabalhador'}</p>

  <div class="summary">
    <div class="summary-item">
      <div class="label">Total trabalhado</div>
      <div class="value">${Math.floor(totalMinTrab / 60)}h ${totalMinTrab % 60}min</div>
    </div>
    <div class="summary-item">
      <div class="label">Horas extras</div>
      <div class="value accent">${Math.floor(totalMinExtra / 60)}h ${totalMinExtra % 60}min</div>
    </div>
    <div class="summary-item">
      <div class="label">Valor estimado extras</div>
      <div class="value warning">R$ ${valorTotal.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="summary-item">
      <div class="label">Dias registrados</div>
      <div class="value">${rows.length}</div>
    </div>
  </div>

  <div class="bh-section">
    <h3>📊 Banco de Horas</h3>
    <div class="bh-item">
      <span>Saldo inicial:</span>
      <span class="bold">${fmtMin(saldoInicial)}</span>
    </div>
    <div class="bh-item">
      <span>Saldo total:</span>
      <span class="bold ${bhSaldo >= 0 ? 'success' : 'danger'}">${fmtMin(bhSaldo)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Dia</th>
        <th>Entrada</th>
        <th>Saída</th>
        <th>Intervalo</th>
        <th>Trabalhado</th>
        <th>Extra</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${r.data}</td>
        <td>${r.diaSemana}</td>
        <td>${r.entrada}</td>
        <td>${r.saida}</td>
        <td>${r.intervalo}</td>
        <td>${r.horasTrab}</td>
        <td>${r.horaExtra}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="legal">
    <strong>⚠️ Aviso Legal:</strong> Este documento possui caráter informativo e estimativo. Não constitui prova legal absoluta. Os valores são baseados em dados fornecidos pelo usuário e regras gerais da legislação.
  </div>

  <div class="footer">
    <p>Cálculo baseado nos percentuais de adicional informados pelo usuário (${percentual}% dias úteis). Verifique com seu sindicato.</p>
    <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    <p>Hora Justa — Ferramenta de Controle de Jornada</p>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({
      html,
      summary: {
        totalHoras: totalMinTrab / 60,
        totalExtra: totalMinExtra / 60,
        valorTotal,
        dias: rows.length,
        bancoHoras: bhSaldo,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
