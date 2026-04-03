import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";

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

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const { data: marcacoes } = await supabase.from("marcacoes_ponto").select("*").eq("user_id", user.id).is("deleted_at", null).order("data").order("horario");
    const { data: bancoEntries } = await supabase.from("banco_horas").select("*").eq("user_id", user.id).order("data");
    const { data: ferias } = await supabase.from("ferias").select("*").eq("user_id", user.id).order("data_inicio");
    const { data: compensacoes } = await supabase.from("compensacoes_banco_horas").select("*").eq("user_id", user.id).order("data");

    const p = profile || {} as any;
    const cargaMin = (p.carga_horaria_diaria || 8) * 60;
    const salario = p.salario_base || 0;
    const percentual = p.hora_extra_percentual || 50;
    const saldoInicial = p.banco_horas_saldo_inicial || 0;
    const valorHN = salario / 220;
    const valorHE = valorHN * (1 + percentual / 100);

    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const fmtData = (d: string) => { if (!d) return ''; const pts = d.split('T')[0].split('-'); return `${pts[2]}/${pts[1]}/${pts[0]}`; };
    const fmtHora = (iso: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
    const fmtMin = (min: number) => { const h = Math.floor(Math.abs(min) / 60); const m = Math.abs(min) % 60; return `${min < 0 ? '-' : ''}${h}h ${String(m).padStart(2, '0')}min`; };

    // Group by day
    const dayMap = new Map<string, any[]>();
    (marcacoes || []).forEach((m: any) => { if (!dayMap.has(m.data)) dayMap.set(m.data, []); dayMap.get(m.data)!.push(m); });

    function calcJornada(marks: any[]) {
      let totalTrab = 0, totalInt = 0, inicioAtual: string | null = null, saidaInt: string | null = null;
      let primeiraEntrada: string | null = null, ultimaSaida: string | null = null;
      for (const m of marks) {
        if (m.tipo === 'entrada' || m.tipo === 'volta_intervalo') {
          if (m.tipo === 'volta_intervalo' && saidaInt) { totalInt += Math.max(0, (new Date(m.horario).getTime() - new Date(saidaInt).getTime()) / 60000); saidaInt = null; }
          inicioAtual = m.horario;
          if (m.tipo === 'entrada' && !primeiraEntrada) primeiraEntrada = m.horario;
        }
        if (m.tipo === 'saida_intervalo' && inicioAtual) { totalTrab += Math.max(0, (new Date(m.horario).getTime() - new Date(inicioAtual).getTime()) / 60000); saidaInt = m.horario; inicioAtual = null; }
        if (m.tipo === 'saida_final') { if (inicioAtual) totalTrab += Math.max(0, (new Date(m.horario).getTime() - new Date(inicioAtual).getTime()) / 60000); ultimaSaida = m.horario; inicioAtual = null; saidaInt = null; }
      }
      return { totalTrab: Math.round(totalTrab), totalInt: Math.round(totalInt), primeiraEntrada, ultimaSaida };
    }

    // Colors
    const PRIMARY = '1A1A2E';
    const ACCENT = '4ECDC4';
    const SUCCESS = '27AE60';
    const DANGER = 'E74C3C';
    const WARNING = 'F39C12';
    const LIGHT_BG = 'F8F9FA';
    const HEADER_BG = '1A1A2E';
    const WHITE = 'FFFFFF';
    const LIGHT_ACCENT = 'E8FAF8';
    const LIGHT_GREEN = 'E8F5E9';
    const LIGHT_RED = 'FFEBEE';
    const LIGHT_YELLOW = 'FFF8E1';

    const headerFont = { bold: true, color: { argb: WHITE }, size: 11, name: 'Arial' };
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: HEADER_BG } };
    const titleFont = { bold: true, size: 16, color: { argb: PRIMARY }, name: 'Arial' };
    const subtitleFont = { bold: true, size: 12, color: { argb: ACCENT }, name: 'Arial' };
    const labelFont = { bold: true, size: 10, color: { argb: '666666' }, name: 'Arial' };
    const valueFont = { bold: true, size: 12, color: { argb: PRIMARY }, name: 'Arial' };
    const normalFont = { size: 10, name: 'Arial' };
    const thinBorder = { style: 'thin' as const, color: { argb: 'DDDDDD' } };
    const borders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hora Justa';
    wb.created = new Date();

    // ═══════════════════════════════════════════
    // ABA 1: DASHBOARD
    // ═══════════════════════════════════════════
    const wsDash = wb.addWorksheet('📊 Dashboard', { properties: { tabColor: { argb: ACCENT } } });
    wsDash.columns = [{ width: 32 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }];

    // Legal disclaimer rows (locked, rows 1-5)
    const disclaimerLines = [
      '⚠ AVISO LEGAL — ISENÇÃO DE RESPONSABILIDADE',
      'Este documento é um extrato matemático privado para organização pessoal.',
      'Não possui valor de laudo pericial, não substitui cartões de ponto oficiais e não constitui prova legal absoluta.',
      'O desenvolvedor isenta-se de responsabilidade por decisões judiciais ou administrativas tomadas com base nestas estimativas.',
      'O nome da empresa e demais dados são informados pelo próprio usuário. Para validação jurídica, consulte um profissional qualificado.',
    ];
    disclaimerLines.forEach((text, i) => {
      wsDash.mergeCells(`A${i + 1}:E${i + 1}`);
      const cell = wsDash.getCell(`A${i + 1}`);
      cell.value = text;
      cell.font = i === 0
        ? { bold: true, size: 11, color: { argb: DANGER }, name: 'Arial' }
        : { size: 9, color: { argb: '666666' }, italic: true, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_YELLOW } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.protection = { locked: true };
      wsDash.getRow(i + 1).height = i === 0 ? 24 : 18;
    });

    // Protect the sheet but allow selecting/scrolling
    wsDash.protect('horajusta', { selectLockedCells: true, selectUnlockedCells: true, formatCells: false, formatColumns: false, insertRows: false, deleteRows: false });

    // Title (row 7)
    wsDash.mergeCells('A7:E7');
    const titleCell = wsDash.getCell('A7');
    titleCell.value = '⚖️ HORA JUSTA — RELATÓRIO COMPLETO';
    titleCell.font = { bold: true, size: 18, color: { argb: PRIMARY }, name: 'Arial' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ACCENT } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDash.getRow(7).height = 40;

    // Date (row 8)
    wsDash.mergeCells('A8:E8');
    const dateCell = wsDash.getCell('A8');
    dateCell.value = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    dateCell.font = { size: 9, color: { argb: '888888' }, italic: true, name: 'Arial' };
    dateCell.alignment = { horizontal: 'center' };

    let row = 10;
    function addSection(title: string, color: string) {
      wsDash.mergeCells(`A${row}:E${row}`);
      const c = wsDash.getCell(`A${row}`);
      c.value = title;
      c.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      c.alignment = { vertical: 'middle' };
      wsDash.getRow(row).height = 28;
      row++;
    }

    function addField(label: string, value: string | number, bgColor?: string) {
      const cA = wsDash.getCell(`A${row}`);
      const cB = wsDash.getCell(`B${row}`);
      cA.value = label;
      cA.font = labelFont;
      cA.border = borders;
      cB.value = value;
      cB.font = valueFont;
      cB.border = borders;
      if (bgColor) {
        cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }
      row++;
    }

    // Dados do Trabalhador
    addSection('📋 DADOS DO TRABALHADOR', PRIMARY);
    addField('Usuário do Sistema', p.nome || '', LIGHT_BG);
    addField('Empresa Informada pelo Usuário', p.empresa || '');
    addField('Carga Horária Diária', `${p.carga_horaria_diaria || 8}h`, LIGHT_BG);
    addField('Salário Base', salario ? `R$ ${Number(salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '');
    addField('Percentual Hora Extra', `${percentual}%`, LIGHT_BG);
    addField('Valor Hora Normal', `R$ ${valorHN.toFixed(2).replace('.', ',')}`);
    addField('Valor Hora Extra', `R$ ${valorHE.toFixed(2).replace('.', ',')}`, LIGHT_BG);
    row++;

    // Resumo
    let totalGeralTrab = 0, totalGeralExtra = 0, totalGeralDevendo = 0;
    let diasComExtra = 0, diasComDevendo = 0, diasTrabalhados = 0;
    const extrasPorDow = [0, 0, 0, 0, 0, 0, 0];
    const trabPorDow = [0, 0, 0, 0, 0, 0, 0];
    const contPorDow = [0, 0, 0, 0, 0, 0, 0];
    const extrasPorMes: Record<string, number> = {};
    const trabPorMes: Record<string, number> = {};
    const contPorMes: Record<string, number> = {};

    const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dailyRows: any[] = [];

    sortedDays.forEach(([data, marks]) => {
      const sorted = marks.sort((a: any, b: any) => a.horario.localeCompare(b.horario));
      const j = calcJornada(sorted);
      const extra = Math.max(0, j.totalTrab - cargaMin);
      const devendo = Math.max(0, cargaMin - j.totalTrab);
      const dt = new Date(data + 'T12:00:00');
      const dow = dt.getDay();
      const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      diasTrabalhados++;
      totalGeralTrab += j.totalTrab;
      totalGeralExtra += extra;
      totalGeralDevendo += devendo;
      if (extra > 0) diasComExtra++;
      if (devendo > 0) diasComDevendo++;
      extrasPorDow[dow] += extra;
      trabPorDow[dow] += j.totalTrab;
      contPorDow[dow]++;
      extrasPorMes[mesKey] = (extrasPorMes[mesKey] || 0) + extra;
      trabPorMes[mesKey] = (trabPorMes[mesKey] || 0) + j.totalTrab;
      contPorMes[mesKey] = (contPorMes[mesKey] || 0) + 1;

      dailyRows.push({
        data: fmtData(data), dia: diasSemana[dow],
        entrada: j.primeiraEntrada ? fmtHora(j.primeiraEntrada) : '',
        saidaInt: sorted.find((m: any) => m.tipo === 'saida_intervalo')?.horario ? fmtHora(sorted.find((m: any) => m.tipo === 'saida_intervalo').horario) : '',
        voltaInt: sorted.find((m: any) => m.tipo === 'volta_intervalo')?.horario ? fmtHora(sorted.find((m: any) => m.tipo === 'volta_intervalo').horario) : '',
        saidaFinal: j.ultimaSaida ? fmtHora(j.ultimaSaida) : '',
        intervalo: j.totalInt > 0 ? fmtMin(j.totalInt) : '',
        totalTrab: fmtMin(j.totalTrab), totalTrabMin: j.totalTrab,
        extra: extra > 0 ? `+${fmtMin(extra)}` : '', extraMin: extra,
        devendo: devendo > 0 ? `-${fmtMin(devendo)}` : '', devendoMin: devendo,
        marcacoes: marks.length,
      });
    });

    const valorTotalExtra = (totalGeralExtra / 60) * valorHE;

    addSection('📊 RESUMO GERAL', ACCENT);
    addField('Total de Dias Trabalhados', diasTrabalhados, LIGHT_ACCENT);
    addField('Total Horas Trabalhadas', fmtMin(totalGeralTrab));
    addField('Total Horas Extras', `+${fmtMin(totalGeralExtra)}`, LIGHT_GREEN);
    addField('Total Horas Devendo', `-${fmtMin(totalGeralDevendo)}`, LIGHT_RED);
    addField('Saldo Líquido', fmtMin(totalGeralExtra - totalGeralDevendo));
    addField('Dias com Hora Extra', diasComExtra, LIGHT_GREEN);
    addField('Dias Devendo Horas', diasComDevendo, LIGHT_RED);
    addField('Valor Estimado Extras', `R$ ${valorTotalExtra.toFixed(2).replace('.', ',')}`, LIGHT_YELLOW);
    row++;

    // Banco de Horas
    let bhSaldo = saldoInicial;
    (bancoEntries || []).forEach((e: any) => {
      if (e.tipo === 'acumulo') bhSaldo += e.minutos;
      else bhSaldo -= e.minutos;
    });

    addSection('🏦 BANCO DE HORAS', SUCCESS);
    addField('Saldo Inicial', fmtMin(saldoInicial), LIGHT_GREEN);
    addField('Saldo Atual', fmtMin(bhSaldo));
    addField('Entradas (Acúmulos)', (bancoEntries || []).filter((b: any) => b.tipo === 'acumulo').length, LIGHT_GREEN);
    addField('Saídas (Compensações)', (bancoEntries || []).filter((b: any) => b.tipo === 'compensacao').length);
    row++;

    // Férias
    addSection('🏖️ FÉRIAS', WARNING);
    addField('Períodos Registrados', (ferias || []).length, LIGHT_YELLOW);
    (ferias || []).forEach((f: any) => {
      addField(`  ${f.tipo || 'Normal'}`, `${fmtData(f.data_inicio)} a ${fmtData(f.data_fim)} — ${f.status || ''}`);
    });
    row++;

    // Tabela Extras por Dia da Semana
    addSection('📈 HORAS EXTRAS POR DIA DA SEMANA', PRIMARY);
    const dowHeaders = ['Dia da Semana', 'Extras (min)', 'Horas Extras', 'Média Trabalhada'];
    dowHeaders.forEach((h, i) => {
      const c = wsDash.getCell(row, i + 1);
      c.value = h; c.font = headerFont; c.fill = headerFill; c.border = borders; c.alignment = { horizontal: 'center' };
    });
    row++;
    diasSemana.forEach((d, i) => {
      const cells = [d, extrasPorDow[i], fmtMin(extrasPorDow[i]), contPorDow[i] > 0 ? fmtMin(Math.round(trabPorDow[i] / contPorDow[i])) : ''];
      cells.forEach((v, ci) => {
        const c = wsDash.getCell(row, ci + 1);
        c.value = v; c.font = normalFont; c.border = borders;
        if (row % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
      });
      row++;
    });
    row++;

    // Tabela Extras por Mês
    addSection('📅 HORAS POR MÊS', ACCENT);
    const mesHeaders = ['Mês', 'Dias', 'Trabalhado (min)', 'Trabalhado', 'Extras (min)', 'Extras'];
    mesHeaders.forEach((h, i) => {
      const c = wsDash.getCell(row, i + 1);
      c.value = h; c.font = headerFont; c.fill = headerFill; c.border = borders; c.alignment = { horizontal: 'center' };
    });
    row++;
    Object.entries(trabPorMes).sort(([a], [b]) => a.localeCompare(b)).forEach(([mesKey, trab]) => {
      const [y, m] = mesKey.split('-');
      const vals = [`${meses[parseInt(m) - 1]} ${y}`, contPorMes[mesKey], trab, fmtMin(trab), extrasPorMes[mesKey] || 0, fmtMin(extrasPorMes[mesKey] || 0)];
      vals.forEach((v, ci) => {
        const c = wsDash.getCell(row, ci + 1);
        c.value = v; c.font = normalFont; c.border = borders;
        if (row % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
      });
      row++;
    });
    row++;

    // Distribuição de Dias
    addSection('📊 DISTRIBUIÇÃO DE DIAS', PRIMARY);
    const distHeaders = ['Tipo', 'Quantidade'];
    distHeaders.forEach((h, i) => {
      const c = wsDash.getCell(row, i + 1);
      c.value = h; c.font = headerFont; c.fill = headerFill; c.border = borders; c.alignment = { horizontal: 'center' };
    });
    row++;
    const distData = [
      ['✅ Dias com Hora Extra', diasComExtra, LIGHT_GREEN],
      ['❌ Dias Devendo', diasComDevendo, LIGHT_RED],
      ['➖ Dias Normais', Math.max(0, diasTrabalhados - diasComExtra - diasComDevendo), LIGHT_BG],
      ['🏖️ Férias', (ferias || []).length, LIGHT_YELLOW],
      ['🔄 Compensações', (compensacoes || []).length, LIGHT_ACCENT],
    ];
    distData.forEach(([label, qty, bg]) => {
      const cA = wsDash.getCell(row, 1); const cB = wsDash.getCell(row, 2);
      cA.value = label; cA.font = { ...normalFont, bold: true }; cA.border = borders;
      cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg as string } };
      cB.value = qty; cB.font = valueFont; cB.border = borders;
      cB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg as string } };
      cB.alignment = { horizontal: 'center' };
      row++;
    });

    // ═══════════════════════════════════════════
    // ABA 2: RESUMO DIÁRIO
    // ═══════════════════════════════════════════
    const wsResumo = wb.addWorksheet('Resumo Diário', { properties: { tabColor: { argb: PRIMARY } } });
    wsResumo.columns = [
      { header: 'Data', width: 12 }, { header: 'Dia', width: 12 },
      { header: 'Entrada', width: 10 }, { header: 'Saída Int.', width: 10 },
      { header: 'Volta Int.', width: 10 }, { header: 'Saída Final', width: 10 },
      { header: 'Intervalo', width: 12 }, { header: 'Trabalhado', width: 14 },
      { header: 'Carga', width: 12 }, { header: 'Hora Extra', width: 14 },
      { header: 'Devendo', width: 14 }, { header: 'Marcações', width: 10 },
    ];
    // Style header
    wsResumo.getRow(1).eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; cell.alignment = { horizontal: 'center' }; });
    wsResumo.getRow(1).height = 24;

    dailyRows.forEach((r, i) => {
      const rowNum = i + 2;
      const wsRow = wsResumo.getRow(rowNum);
      wsRow.values = [r.data, r.dia, r.entrada, r.saidaInt, r.voltaInt, r.saidaFinal, r.intervalo, r.totalTrab, fmtMin(cargaMin), r.extra, r.devendo, r.marcacoes];
      wsRow.eachCell((cell) => { cell.font = normalFont; cell.border = borders; });
      if (r.extraMin > 0) {
        wsRow.getCell(10).font = { ...normalFont, bold: true, color: { argb: SUCCESS } };
      }
      if (r.devendoMin > 0) {
        wsRow.getCell(11).font = { ...normalFont, bold: true, color: { argb: DANGER } };
      }
      if (i % 2 === 1) {
        wsRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }; });
      }
    });

    // Total row
    const totalRowNum = dailyRows.length + 2;
    const totalRow = wsResumo.getRow(totalRowNum);
    totalRow.values = ['', 'TOTAIS', '', '', '', '', '', fmtMin(totalGeralTrab), fmtMin(cargaMin * diasTrabalhados), `+${fmtMin(totalGeralExtra)}`, `-${fmtMin(totalGeralDevendo)}`, (marcacoes || []).length];
    totalRow.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: WHITE }, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
      cell.border = borders;
    });
    totalRow.height = 26;

    // ═══════════════════════════════════════════
    // ABA 3: MARCAÇÕES
    // ═══════════════════════════════════════════
    const wsMarc = wb.addWorksheet('Marcações', { properties: { tabColor: { argb: '3498DB' } } });
    wsMarc.columns = [
      { header: 'Data', width: 12 }, { header: 'Dia', width: 12 },
      { header: 'Tipo', width: 20 }, { header: 'Horário', width: 10 },
      { header: 'Origem', width: 10 },
    ];
    wsMarc.getRow(1).eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; cell.alignment = { horizontal: 'center' }; });

    const tipoColors: Record<string, string> = { entrada: SUCCESS, saida_intervalo: WARNING, volta_intervalo: '3498DB', saida_final: DANGER };
    const tipoLabels: Record<string, string> = { entrada: 'Entrada', saida_intervalo: 'Saída Intervalo', volta_intervalo: 'Volta Intervalo', saida_final: 'Saída Final' };

    (marcacoes || []).forEach((m: any, i: number) => {
      const r = wsMarc.getRow(i + 2);
      const dt = new Date(m.data + 'T12:00:00');
      r.values = [fmtData(m.data), diasSemana[dt.getDay()], tipoLabels[m.tipo] || m.tipo, fmtHora(m.horario), m.origem === 'botao' ? 'Botão' : m.origem === 'manual' ? 'Manual' : m.origem || ''];
      r.eachCell((cell) => { cell.font = normalFont; cell.border = borders; });
      r.getCell(3).font = { ...normalFont, bold: true, color: { argb: tipoColors[m.tipo] || PRIMARY } };
      if (i % 2 === 1) r.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }; });
    });

    // ═══════════════════════════════════════════
    // ABA 4: BANCO DE HORAS
    // ═══════════════════════════════════════════
    const wsBH = wb.addWorksheet('Banco de Horas', { properties: { tabColor: { argb: SUCCESS } } });
    wsBH.columns = [
      { header: 'Data', width: 12 }, { header: 'Tipo', width: 18 },
      { header: 'Horas', width: 16 }, { header: 'Minutos', width: 10 },
      { header: 'Expira em', width: 14 }, { header: 'Nota', width: 30 },
    ];
    wsBH.getRow(1).eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; cell.alignment = { horizontal: 'center' }; });

    (bancoEntries || []).forEach((b: any, i: number) => {
      const r = wsBH.getRow(i + 2);
      r.values = [fmtData(b.data), b.tipo === 'acumulo' ? '⬆ Acúmulo' : '⬇ Compensação', fmtMin(b.minutos), b.minutos, fmtData(b.expira_em?.split('T')[0] || ''), b.nota || ''];
      r.eachCell((cell) => { cell.font = normalFont; cell.border = borders; });
      r.getCell(2).font = { ...normalFont, bold: true, color: { argb: b.tipo === 'acumulo' ? SUCCESS : DANGER } };
      if (i % 2 === 1) r.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }; });
    });

    // Saldo row
    const bhTotalRow = (bancoEntries || []).length + 2;
    const bhr = wsBH.getRow(bhTotalRow);
    bhr.values = ['', 'SALDO TOTAL', fmtMin(bhSaldo), bhSaldo, '', ''];
    bhr.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: WHITE }, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bhSaldo >= 0 ? SUCCESS : DANGER } };
      cell.border = borders;
    });

    // ═══════════════════════════════════════════
    // ABA 5: COMPENSAÇÕES
    // ═══════════════════════════════════════════
    const wsComp = wb.addWorksheet('Compensações', { properties: { tabColor: { argb: '9B59B6' } } });
    wsComp.columns = [
      { header: 'Data', width: 12 }, { header: 'Horas', width: 16 },
      { header: 'Minutos', width: 10 }, { header: 'Tipo', width: 16 },
      { header: 'Observação', width: 30 },
    ];
    wsComp.getRow(1).eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; cell.alignment = { horizontal: 'center' }; });

    (compensacoes || []).forEach((c: any, i: number) => {
      const r = wsComp.getRow(i + 2);
      r.values = [fmtData(c.data), fmtMin(c.minutos), c.minutos, c.tipo === 'dia_completo' ? 'Dia Completo' : c.tipo || '', c.observacao || ''];
      r.eachCell((cell) => { cell.font = normalFont; cell.border = borders; });
      if (i % 2 === 1) r.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }; });
    });

    // ═══════════════════════════════════════════
    // ABA 6: FÉRIAS
    // ═══════════════════════════════════════════
    const wsFer = wb.addWorksheet('Férias', { properties: { tabColor: { argb: WARNING } } });
    wsFer.columns = [
      { header: 'Início', width: 12 }, { header: 'Fim', width: 12 },
      { header: 'Tipo', width: 16 }, { header: 'Status', width: 14 },
      { header: 'Dias Direito', width: 14 }, { header: 'Observação', width: 30 },
    ];
    wsFer.getRow(1).eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.border = borders; cell.alignment = { horizontal: 'center' }; });

    (ferias || []).forEach((f: any, i: number) => {
      const r = wsFer.getRow(i + 2);
      r.values = [fmtData(f.data_inicio), fmtData(f.data_fim), f.tipo || 'Normal', f.status || '', f.dias_direito || 30, f.observacao || ''];
      r.eachCell((cell) => { cell.font = normalFont; cell.border = borders; });
      if (i % 2 === 1) r.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }; });
    });

    // ═══════════════════════════════════════════
    // ABA 7: PERFIL
    // ═══════════════════════════════════════════
    const wsPerf = wb.addWorksheet('Perfil', { properties: { tabColor: { argb: '34495E' } } });
    wsPerf.columns = [{ width: 30 }, { width: 32 }];

    wsPerf.mergeCells('A1:B1');
    wsPerf.getCell('A1').value = '👤 DADOS DO PERFIL';
    wsPerf.getCell('A1').font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
    wsPerf.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    wsPerf.getCell('A1').alignment = { horizontal: 'center' };
    wsPerf.getRow(1).height = 30;

    const perfFields = [
      ['Nome', p.nome || ''], ['Empresa', p.empresa || ''],
      ['Carga Horária Diária', `${p.carga_horaria_diaria || 8}h`],
      ['Salário Base', salario ? `R$ ${Number(salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''],
      ['Tipo de Jornada', p.tipo_jornada || ''], ['Modo de Trabalho', p.modo_trabalho || ''],
      ['Percentual Hora Extra', `${percentual}%`], ['Intervalo Almoço', `${p.intervalo_almoco || 60} min`],
      ['Dias Trabalhados/Semana', p.dias_trabalhados_semana || 5],
      ['Saldo Inicial Banco Horas', fmtMin(saldoInicial)],
      ['Data Admissão', p.data_admissao ? fmtData(p.data_admissao) : ''],
      ['Horário Entrada Padrão', p.horario_entrada_padrao || ''],
      ['Horário Saída Padrão', p.horario_saida_padrao || ''],
    ];

    perfFields.forEach(([label, value], i) => {
      const r = wsPerf.getRow(i + 2);
      r.values = [label, value];
      r.getCell(1).font = labelFont;
      r.getCell(1).border = borders;
      r.getCell(2).font = valueFont;
      r.getCell(2).border = borders;
      if (i % 2 === 0) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
      }
    });

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer as ArrayBuffer);

    return new Response(uint8, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="hora-justa-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
