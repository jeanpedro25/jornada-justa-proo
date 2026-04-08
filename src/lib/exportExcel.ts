/**
 * exportExcel.ts — Hora Justa
 * Planilha Excel premium com formatação profissional via ExcelJS.
 * 3 abas: Capa | Registros | Resumo por semana
 */
import ExcelJS from 'exceljs';
import { formatarDuracaoJornada, formatarHoraLocal } from './jornada';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ExcelDaySummary {
  data: string;
  totalMin: number;
  extraMin: number;
  devendoMin: number;
  intervaloMin: number;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
  origem: string;
  feriadoNome?: string | null;
  atestadoPeriodo?: string | null;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  teal:        '0D9488', // brand teal
  tealLight:   'CCFBF1',
  tealDark:    '0F766E',
  dark:        '1A1A2E',
  white:       'FFFFFF',
  offWhite:    'F8FAFC',
  gray100:     'F1F5F9',
  gray200:     'E2E8F0',
  gray400:     '94A3B8',
  gray600:     '475569',
  amber:       'D97706',
  amberLight:  'FEF3C7',
  red:         'DC2626',
  redLight:    'FEE2E2',
  green:       '16A34A',
  greenLight:  'DCFCE7',
  purple:      '7C3AED',
  purpleLight: 'EDE9FE',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtHora(iso: string | null): string {
  if (!iso) return '—';
  return formatarHoraLocal(iso);
}

function fmtDur(min: number, zeroStr = '—'): string {
  if (min === 0) return zeroStr;
  return formatarDuracaoJornada(min);
}

function fmtSaldo(min: number): string {
  if (min === 0) return '=';
  const dur = formatarDuracaoJornada(Math.abs(min));
  return min > 0 ? `+${dur}` : `-${dur}`;
}

function origemLabel(origem: string, feriadoNome?: string | null): string {
  const map: Record<string, string> = {
    real:          'Registro real',
    manual:        'Manual',
    reconstituido: 'Reconstituído',
    atestado:      'Atestado médico',
    feriado:       feriadoNome ? `Feriado: ${feriadoNome}` : 'Feriado',
    ferias:        'Férias / Folga',
    pendente:      'Pendente',
    fds:           'Fim de semana',
    folga:         'Folga',
    falta:         'Falta',
  };
  return map[origem] ?? origem;
}

function origemColor(origem: string) {
  switch (origem) {
    case 'real':    return C.greenLight;
    case 'manual':  return C.tealLight;
    case 'feriado': return C.purpleLight;
    case 'ferias':  return C.purpleLight;
    case 'atestado': return C.amberLight;
    case 'falta':   return C.redLight;
    case 'pendente': return C.amberLight;
    default:        return C.offWhite;
  }
}

// helper for ExcelJS fill
function fill(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

function font(hex: string, bold = false, size = 10, name = 'Calibri'): Partial<ExcelJS.Font> {
  return { color: { argb: `FF${hex}` }, bold, size, name };
}

function border(hex = C.gray200): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'thin';
  const c = { style: s, color: { argb: `FF${hex}` } };
  return { top: c, bottom: c, left: c, right: c };
}

function align(h: ExcelJS.Alignment['horizontal'] = 'left'): Partial<ExcelJS.Alignment> {
  return { horizontal: h, vertical: 'middle', wrapText: false };
}

// helper to row-fill a header row
function styleHeader(row: ExcelJS.Row, bgHex: string, fgHex: string) {
  row.height = 24;
  row.eachCell(cell => {
    cell.fill = fill(bgHex);
    cell.font = font(fgHex, true, 11);
    cell.alignment = align('center');
    cell.border = border(bgHex);
  });
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportarExcel(
  days: ExcelDaySummary[],
  nomeUsuario: string,
  periodo: string,
  salario: number,
  percentualExtra: number,
  empresa?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hora Justa';
  wb.created = new Date();

  const diasOrdenados = [...days].sort((a, b) => a.data.localeCompare(b.data));

  // ── Cálculos ────────────────────────────────────────────────────────────
  const diasComTrab  = diasOrdenados.filter(d => d.totalMin > 0 && d.origem !== 'reconstituido');
  const totalTrab    = diasComTrab.reduce((s, d) => s + d.totalMin, 0);
  const totalExtra   = diasComTrab.reduce((s, d) => s + d.extraMin, 0);
  const totalDevendo = diasComTrab.reduce((s, d) => s + d.devendoMin, 0);
  const totalSaldo   = totalExtra - totalDevendo;
  const diasTrab     = diasComTrab.length;
  const media        = diasTrab > 0 ? Math.round(totalTrab / diasTrab) : 0;
  const valorHE      = salario > 0 ? (salario / 220) * (1 + percentualExtra / 100) : 0;
  const valorExtras  = (totalExtra / 60) * valorHE;

  // ════════════════════════════════════════════════════════════════════════
  // SHEET 1 — CAPA / RESUMO
  // ════════════════════════════════════════════════════════════════════════
  const sh1 = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: `FF${C.teal}` } } });
  sh1.views = [{ showGridLines: false }];
  sh1.columns = [
    { key: 'a', width: 30 },
    { key: 'b', width: 28 },
    { key: 'c', width: 16 },
  ];

  // ── Banner ────────────────────────────────────────────────────────────
  const bannerRows = [
    sh1.addRow(['', '', '']),
    sh1.addRow(['  HORA JUSTA', '', '']),
    sh1.addRow(['  Extrato de Jornada de Trabalho', '', '']),
    sh1.addRow(['', '', '']),
  ];

  sh1.mergeCells('A1:C1');
  sh1.mergeCells('A2:C2');
  sh1.mergeCells('A3:C3');
  sh1.mergeCells('A4:C4');

  bannerRows.forEach(r => {
    r.height = r.number === 2 ? 36 : r.number === 3 ? 24 : 10;
    r.eachCell(cell => { cell.fill = fill(C.dark); });
  });

  sh1.getCell('A2').font = { ...font(C.teal, true, 20), name: 'Calibri' };
  sh1.getCell('A3').font = font(C.white, false, 12);

  // ── Info block ────────────────────────────────────────────────────────
  function infoRow(label: string, value: string) {
    const r = sh1.addRow([`  ${label}`, value, '']);
    r.height = 20;
    sh1.mergeCells(`B${r.number}:C${r.number}`);
    r.getCell(1).font = font(C.gray400, false, 10);
    r.getCell(1).fill = fill(C.dark);
    r.getCell(2).font = font(C.white, true, 11);
    r.getCell(2).fill = fill(C.dark);
    return r;
  }

  infoRow('Trabalhador', nomeUsuario);
  if (empresa) infoRow('Empresa', empresa);
  infoRow('Período', periodo);
  infoRow('Gerado em', new Date().toLocaleString('pt-BR'));

  // spacer
  const spacer1 = sh1.addRow(['', '', '']);
  spacer1.height = 10;
  spacer1.eachCell(c => { c.fill = fill(C.dark); });

  sh1.addRow(['', '', '']);

  // ── Stats cards ───────────────────────────────────────────────────────
  function statCard(
    label: string, value: string,
    bgHex: string, fgHex: string, valHex: string,
  ) {
    const labelRow = sh1.addRow([`  ${label}`, '', '']);
    labelRow.height = 18;
    sh1.mergeCells(`A${labelRow.number}:C${labelRow.number}`);
    labelRow.getCell(1).fill = fill(bgHex);
    labelRow.getCell(1).font = font(fgHex, false, 9);

    const valRow = sh1.addRow([`  ${value}`, '', '']);
    valRow.height = 28;
    sh1.mergeCells(`A${valRow.number}:C${valRow.number}`);
    valRow.getCell(1).fill = fill(bgHex);
    valRow.getCell(1).font = { ...font(valHex, true, 18), name: 'Calibri' };

    const gapRow = sh1.addRow(['', '', '']);
    gapRow.height = 6;
  }

  statCard('Dias trabalhados', String(diasTrab), C.tealLight, C.tealDark, C.tealDark);
  statCard('Total trabalhado', fmtDur(totalTrab, '0h'), C.tealLight, C.tealDark, C.tealDark);
  statCard('Média por dia', fmtDur(media, '—'), C.gray100, C.gray600, C.dark);
  statCard(
    'Saldo de horas extras',
    fmtSaldo(totalSaldo),
    totalSaldo >= 0 ? C.greenLight : C.redLight,
    totalSaldo >= 0 ? C.green : C.red,
    totalSaldo >= 0 ? C.green : C.red,
  );

  if (salario > 0 && totalExtra > 0) {
    statCard(
      'Estimativa extras (bruto)',
      valorExtras.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      C.amberLight, C.amber, C.amber,
    );
  }

  sh1.addRow(['', '', '']);

  // ── Distribution table ────────────────────────────────────────────────
  const dtHeader = sh1.addRow(['  📊 Distribuição de registros', '', '']);
  dtHeader.height = 22;
  sh1.mergeCells(`A${dtHeader.number}:C${dtHeader.number}`);
  dtHeader.getCell(1).fill = fill(C.dark);
  dtHeader.getCell(1).font = font(C.white, true, 11);

  const tipos: [string, number, string][] = [
    ['Registros reais / manuais',  days.filter(d => ['real','manual'].includes(d.origem)).length, C.greenLight],
    ['Reconstituídos',             days.filter(d => d.origem === 'reconstituido').length,          C.offWhite],
    ['Atestados médicos',          days.filter(d => d.origem === 'atestado').length,               C.amberLight],
    ['Feriados',                   days.filter(d => d.origem === 'feriado').length,                C.purpleLight],
    ['Férias / Folgas',            days.filter(d => d.origem === 'ferias').length,                 C.purpleLight],
    ['Faltas',                     days.filter(d => d.origem === 'falta').length,                  C.redLight],
    ['Pendentes',                  days.filter(d => d.origem === 'pendente').length,               C.amberLight],
    ['Fins de semana / Folga',     days.filter(d => ['fds','folga'].includes(d.origem)).length,    C.gray100],
  ];

  tipos.forEach(([label, count, bg]) => {
    if (count === 0) return;
    const r = sh1.addRow([`  ${label}`, count, '']);
    r.height = 20;
    sh1.mergeCells(`B${r.number}:C${r.number}`);
    r.getCell(1).fill = fill(bg);
    r.getCell(1).font = font(C.dark, false, 10);
    r.getCell(2).fill = fill(bg);
    r.getCell(2).font = font(C.dark, true, 11);
    r.getCell(2).alignment = align('center');
  });

  sh1.addRow(['', '', '']);

  // ── Legal footer ──────────────────────────────────────────────────────
  const legal = sh1.addRow(['  ⚠️  Este extrato é uma ferramenta de controle pessoal. Não substitui documentos oficiais. Consulte seu holerite.', '', '']);
  legal.height = 36;
  sh1.mergeCells(`A${legal.number}:C${legal.number}`);
  legal.getCell(1).fill = fill(C.amberLight);
  legal.getCell(1).font = font(C.amber, false, 9);
  legal.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

  // ════════════════════════════════════════════════════════════════════════
  // SHEET 2 — REGISTROS DETALHADOS
  // ════════════════════════════════════════════════════════════════════════
  const sh2 = wb.addWorksheet('Registros', { properties: { tabColor: { argb: `FF${C.tealDark}` } } });
  sh2.views = [{ showGridLines: false, state: 'frozen', ySplit: 2 }];

  sh2.columns = [
    { key: 'data',     width: 13, header: 'Data' },
    { key: 'dia',      width: 7,  header: 'Dia' },
    { key: 'entrada',  width: 9,  header: 'Entrada' },
    { key: 'saida',    width: 9,  header: 'Saída' },
    { key: 'intervalo',width: 11, header: 'Intervalo' },
    { key: 'trab',     width: 13, header: 'Trabalhado' },
    { key: 'extra',    width: 13, header: 'Hora Extra' },
    { key: 'devendo',  width: 12, header: 'Devendo' },
    { key: 'saldo',    width: 12, header: 'Saldo dia' },
    { key: 'tipo',     width: 24, header: 'Tipo' },
  ];

  // Title row
  const sh2Title = sh2.insertRow(1, ['HORA JUSTA — Registros Detalhados', '', '', '', '', '', '', '', '', '']);
  sh2Title.height = 28;
  sh2.mergeCells('A1:J1');
  sh2Title.getCell(1).fill = fill(C.dark);
  sh2Title.getCell(1).font = font(C.teal, true, 14);
  sh2Title.getCell(1).alignment = align('center');

  // Header row (row 2, since we inserted row 1)
  const headerRow = sh2.getRow(2);
  headerRow.height = 22;
  styleHeader(headerRow, C.teal, C.white);

  // Data rows
  let altRow = false;
  diasOrdenados.forEach(d => {
    const dateObj = new Date(d.data + 'T12:00:00');
    const diaSem  = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
    const dataFmt = dateObj.toLocaleDateString('pt-BR');
    const saldoDia = d.extraMin - d.devendoMin;
    const bgColor  = origemColor(d.origem);

    const row = sh2.addRow({
      data:      dataFmt,
      dia:       diaSem,
      entrada:   fmtHora(d.primeiraEntrada),
      saida:     fmtHora(d.ultimaSaida),
      intervalo: fmtDur(d.intervaloMin),
      trab:      fmtDur(d.totalMin),
      extra:     d.extraMin > 0   ? `+${fmtDur(d.extraMin)}`   : '—',
      devendo:   d.devendoMin > 0 ? `-${fmtDur(d.devendoMin)}` : '—',
      saldo:     fmtSaldo(saldoDia),
      tipo:      origemLabel(d.origem, d.feriadoNome),
    });

    row.height = 18;
    const rowBg = d.origem === 'fds' || d.origem === 'folga' ? C.gray100 : bgColor;

    row.eachCell((cell, col) => {
      cell.fill = fill(altRow && rowBg === C.offWhite ? C.gray100 : rowBg);
      cell.font = font(
        d.origem === 'falta' ? C.red :
        d.origem === 'pendente' ? C.amber :
        ['fds', 'folga', 'reconstituido'].includes(d.origem) ? C.gray400 :
        C.dark,
        false, 10,
      );
      cell.border = border(C.gray200);
      cell.alignment = align(col === 10 ? 'left' : 'center');
    });

    // Highlight extra column green when > 0
    if (d.extraMin > 0) {
      row.getCell('extra').font = font(C.green, true, 10);
    }
    // Highlight devendo red when > 0
    if (d.devendoMin > 0) {
      row.getCell('devendo').font = font(C.red, true, 10);
    }
    // Saldo color
    if (saldoDia > 0)  row.getCell('saldo').font = font(C.green, true, 10);
    if (saldoDia < 0)  row.getCell('saldo').font = font(C.red, true, 10);

    altRow = !altRow;
  });

  // Totals row
  sh2.addRow({});

  const totRow = sh2.addRow({
    data:      'TOTAL',
    dia:       `${diasTrab} dias`,
    intervalo: '',
    trab:      fmtDur(totalTrab, '0h'),
    extra:     totalExtra > 0   ? `+${fmtDur(totalExtra)}`   : '0h',
    devendo:   totalDevendo > 0 ? `-${fmtDur(totalDevendo)}` : '0h',
    saldo:     fmtSaldo(totalSaldo),
    tipo:      '',
  });
  totRow.height = 24;
  styleHeader(totRow, C.dark, C.teal);
  if (totalSaldo > 0) totRow.getCell('saldo').font = font(C.tealLight, true, 11);
  if (totalSaldo < 0) totRow.getCell('saldo').font = font(C.redLight, true, 11);

  // ════════════════════════════════════════════════════════════════════════
  // SHEET 3 — EXTRAS POR SEMANA
  // ════════════════════════════════════════════════════════════════════════
  const sh3 = wb.addWorksheet('Semana a semana', { properties: { tabColor: { argb: `FF${C.amber}` } } });
  sh3.views = [{ showGridLines: false, state: 'frozen', ySplit: 2 }];

  sh3.columns = [
    { key: 'sem',    width: 22, header: 'Semana' },
    { key: 'dias',   width: 14, header: 'Dias trab.' },
    { key: 'trab',   width: 16, header: 'Total trab.' },
    { key: 'extra',  width: 15, header: 'Hora extra' },
    { key: 'devendo',width: 15, header: 'Devendo' },
    { key: 'saldo',  width: 14, header: 'Saldo' },
    { key: 'valor',  width: 20, header: 'Valor est. extras' },
  ];

  const sh3Title = sh3.insertRow(1, ['HORA JUSTA — Extras por Semana', '', '', '', '', '', '']);
  sh3Title.height = 28;
  sh3.mergeCells('A1:G1');
  sh3Title.getCell(1).fill = fill(C.dark);
  sh3Title.getCell(1).font = font(C.amber, true, 14);
  sh3Title.getCell(1).alignment = align('center');

  styleHeader(sh3.getRow(2), C.amber, C.white);

  // Group by week
  const semMap = new Map<string, { extra: number; trab: number; devendo: number; dias: number; from: string }>();
  diasOrdenados.forEach(d => {
    if (d.totalMin === 0 && d.origem === 'fds') return;
    const date = new Date(d.data + 'T12:00:00');
    const day  = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const seg  = new Date(date);
    seg.setDate(diff);
    const semKey = seg.toISOString().slice(0, 10);
    const label  = `${seg.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${
      new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }`;
    if (!semMap.has(semKey)) semMap.set(semKey, { extra: 0, trab: 0, devendo: 0, dias: 0, from: label });
    const s = semMap.get(semKey)!;
    s.extra   += d.extraMin;
    s.trab    += d.totalMin;
    s.devendo += d.devendoMin;
    if (d.totalMin > 0) s.dias += 1;
  });

  Array.from(semMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, v]) => {
      const saldoSem  = v.extra - v.devendo;
      const valorSem  = salario > 0 && v.extra > 0
        ? (v.extra / 60 * valorHE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—';

      const row = sh3.addRow({
        sem:     v.from,
        dias:    v.dias,
        trab:    fmtDur(v.trab, '—'),
        extra:   v.extra > 0   ? `+${fmtDur(v.extra)}`   : '—',
        devendo: v.devendo > 0 ? `-${fmtDur(v.devendo)}` : '—',
        saldo:   fmtSaldo(saldoSem),
        valor:   valorSem,
      });

      row.height = 20;
      row.eachCell((cell, col) => {
        cell.border = border(C.gray200);
        cell.font   = font(C.dark, false, 10);
        cell.alignment = align(col === 1 ? 'left' : 'center');
        cell.fill   = fill(v.extra > 0 ? C.amberLight : C.offWhite);
      });

      if (v.extra > 0) row.getCell('extra').font = font(C.amber, true, 10);
      if (v.devendo > 0) row.getCell('devendo').font = font(C.red, true, 10);
      if (saldoSem > 0) row.getCell('saldo').font = font(C.green, true, 10);
      if (saldoSem < 0) row.getCell('saldo').font = font(C.red, true, 10);
      if (saldoSem === 0) row.getCell('saldo').font = font(C.gray400, false, 10);
    });

  // Totals
  sh3.addRow({});
  const s3Tot = sh3.addRow({
    sem:    'TOTAL',
    dias:   diasTrab,
    trab:   fmtDur(totalTrab, '0h'),
    extra:  totalExtra > 0 ? `+${fmtDur(totalExtra)}` : '0h',
    devendo: totalDevendo > 0 ? `-${fmtDur(totalDevendo)}` : '0h',
    saldo:  fmtSaldo(totalSaldo),
    valor:  salario > 0 && totalExtra > 0
      ? valorExtras.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—',
  });
  s3Tot.height = 24;
  styleHeader(s3Tot, C.dark, C.amber);

  // ── Download ──────────────────────────────────────────────────────────
  const buf   = await wb.xlsx.writeBuffer();
  const blob  = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `hora-justa-${periodo.replace(/\s+/g, '-').replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
