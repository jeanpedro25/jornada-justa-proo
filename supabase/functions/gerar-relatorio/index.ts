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

    // Get user from token
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

    // Fetch registros
    const { data: registros } = await supabase
      .from("registros_ponto")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("data", startDate)
      .lt("data", endDate)
      .order("data", { ascending: true });

    const carga = profile?.carga_horaria_diaria ?? 8;
    const salario = profile?.salario_base ?? 0;
    const percentual = profile?.hora_extra_percentual ?? 50;
    const valorHoraNormal = salario / 220;
    const valorHE = valorHoraNormal * (1 + percentual / 100);

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let totalHoras = 0;
    let totalExtra = 0;

    const rows = (registros || []).map((r: any) => {
      const entrada = new Date(r.entrada);
      const saida = r.saida ? new Date(r.saida) : null;
      const intervalo = r.intervalo_minutos ?? 60;

      let ht = 0;
      let he = 0;
      if (saida) {
        const diffMin = (saida.getTime() - entrada.getTime()) / 60000;
        ht = Math.max(0, (diffMin - intervalo) / 60);
        he = Math.max(0, ht - carga);
      }
      totalHoras += ht;
      totalExtra += he;

      const dateStr = new Date(r.data + 'T12:00:00');
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

      return {
        data: dateStr.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diaSemana: diasSemana[dateStr.getDay()],
        entrada: entrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        saida: saida ? saida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—',
        intervalo: `${intervalo}min`,
        horasTrab: ht.toFixed(1) + 'h',
        horaExtra: he > 0 ? '+' + he.toFixed(1) + 'h' : '—',
        anexo: r.anexo_url ? 'Sim' : '',
        editado: r.editado_manualmente ? '✏️' : '',
      };
    });

    const valorTotal = totalExtra * valorHE;

    // Generate HTML for PDF
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; font-size: 12px; }
  h1 { color: #1a1a2e; font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
  .summary { display: flex; gap: 20px; margin-bottom: 24px; }
  .summary-item { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; flex: 1; }
  .summary-item .label { font-size: 10px; color: #888; text-transform: uppercase; }
  .summary-item .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
  .accent { color: #4ECDC4; }
  .warning { color: #F39C12; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1a1a2e; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
  .legal { margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 10px; }
</style>
</head>
<body>
  <h1>⚖️ Hora Justa — Relatório de Jornada</h1>
  <p class="subtitle">${meses[month - 1]} ${year} · ${profile?.nome || 'Trabalhador'}</p>

  <div class="summary">
    <div class="summary-item">
      <div class="label">Total trabalhado</div>
      <div class="value">${totalHoras.toFixed(1)}h</div>
    </div>
    <div class="summary-item">
      <div class="label">Horas extras</div>
      <div class="value accent">${totalExtra.toFixed(1)}h</div>
    </div>
    <div class="summary-item">
      <div class="label">O patrão te deve</div>
      <div class="value warning">R$ ${valorTotal.toFixed(2).replace('.', ',')}</div>
    </div>
    <div class="summary-item">
      <div class="label">Dias registrados</div>
      <div class="value">${rows.length}</div>
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
        <th>Atestado</th>
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
        <td>${r.anexo} ${r.editado}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="legal">
    <strong>⚠️ Aviso Legal:</strong> Este relatório foi gerado automaticamente pelo app Hora Justa com base nos registros do trabalhador. Serve como prova documental para fins trabalhistas conforme Art. 74 da CLT. Registros editados manualmente estão marcados com ✏️.
  </div>

  <div class="footer">
    <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    <p>Hora Justa — Protegendo o trabalhador brasileiro</p>
  </div>
</body>
</html>`;

    return new Response(JSON.stringify({ html, summary: { totalHoras, totalExtra, valorTotal, dias: rows.length } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
